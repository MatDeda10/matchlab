import { z } from "zod";
import type {
  CompetitionDto,
  FixtureDto,
  FixtureStatisticsDto,
  OddsQuoteDto,
  TeamDto,
} from "@/lib/db/types";
import { getCache, setCache } from "@/lib/db/repositories";
import { fetchText, RateLimiter } from "../http";
import {
  ok,
  unavailable,
  type FixtureQuery,
  type FootballDataProvider,
  type ProviderCapabilities,
  type ProviderResult,
  type ProviderSyncBundle,
} from "../provider";
import {
  integerOrNull,
  localKickoffToUtc,
  numberOrNull,
  parseCsv,
  parseDate,
  seasonCode,
  seasonLabel,
  slugify,
  startYearFor,
  toObjects,
  type ParsedDate,
} from "./csv";
import { resolveTeamName } from "./teams";

const PROVIDER_ID = "football-data-uk";
const SOURCE = "football-data.co.uk";
const BASE_URL = "https://www.football-data.co.uk";
const OPEN_FOOTBALL_BASE =
  "https://raw.githubusercontent.com/openfootball/football.json/master";
const CACHE_TTL_SECONDS = 6 * 60 * 60;

interface LeagueConfig {
  code: string;
  name: string;
  country: string;
  tier: number;
  timeZone: string;
  openFootballPath?: string;
}

const LEAGUES: LeagueConfig[] = [
  {
    code: "I1",
    name: "Serie A",
    country: "Italia",
    tier: 1,
    timeZone: "Europe/Rome",
    openFootballPath: "it.1.json",
  },
  {
    code: "E0",
    name: "Premier League",
    country: "Inghilterra",
    tier: 1,
    timeZone: "Europe/London",
    openFootballPath: "en.1.json",
  },
  {
    code: "E1",
    name: "Championship",
    country: "Inghilterra",
    tier: 2,
    timeZone: "Europe/London",
    openFootballPath: "en.2.json",
  },
  {
    code: "SP1",
    name: "LaLiga",
    country: "Spagna",
    tier: 1,
    timeZone: "Europe/Madrid",
    openFootballPath: "es.1.json",
  },
  {
    code: "D1",
    name: "Bundesliga",
    country: "Germania",
    tier: 1,
    timeZone: "Europe/Berlin",
    openFootballPath: "de.1.json",
  },
  {
    code: "F1",
    name: "Ligue 1",
    country: "Francia",
    tier: 1,
    timeZone: "Europe/Paris",
    openFootballPath: "fr.1.json",
  },
];

const LEAGUE_BY_CODE = new Map(LEAGUES.map((league) => [league.code, league]));

const BOOKMAKERS: Record<string, string> = {
  "1XB": "1XBet",
  B365: "Bet365",
  BF: "Betfair",
  BFD: "Betfred",
  BFE: "Betfair Exchange",
  BMGM: "BetMGM",
  BV: "BetVictor",
  BW: "Bet&Win",
  CL: "Coral",
  GB: "Gamebookers",
  IW: "Interwetten",
  LB: "Ladbrokes",
  P: "Pinnacle",
  PP: "Paddy Power",
  PS: "Pinnacle",
  SB: "Sportingbet",
  SJ: "Stan James",
  SK: "Sky Bet",
  SKB: "Sky Bet",
  SO: "Sporting Odds",
  SY: "Stanleybet",
  VC: "VC Bet",
  WH: "William Hill",
};

const ODDS_CODES = Object.keys(BOOKMAKERS);

const OF_MATCH_SCHEMA = z.object({
  round: z.string().nullish(),
  date: z.string(),
  time: z.string().nullish(),
  team1: z.string(),
  team2: z.string(),
  score: z
    .union([
      z.array(z.number()).length(2),
      z
        .object({
          ft: z.array(z.number()).length(2).nullish(),
          ht: z.array(z.number()).length(2).nullish(),
        })
        .passthrough(),
    ])
    .nullish(),
});

const OF_FILE_SCHEMA = z.object({
  name: z.string(),
  matches: z.array(OF_MATCH_SCHEMA),
});

interface InternalMatch {
  fixture: FixtureDto;
  dateKey: string;
  odds: Map<string, OddsQuoteDto>;
  statistics: FixtureStatisticsDto | null;
  sourceRefs: Set<string>;
}

interface ParsedSeason {
  league: LeagueConfig;
  season: string;
  rows: Array<Record<string, string>>;
  warning?: string;
}

interface Dataset {
  competitions: CompetitionDto[];
  teams: TeamDto[];
  matches: InternalMatch[];
  odds: OddsQuoteDto[];
  statistics: FixtureStatisticsDto[];
  warnings: string[];
  fetchedAt: string;
}

function competitionId(code: string): string {
  return `fduk-${code.toLowerCase()}`;
}

function currentSeasonStart(now = new Date()): number {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? year : year - 1;
}

function historySeasonStarts(now: Date): number[] {
  const configured = Number(process.env.FOOTBALL_DATA_UK_HISTORY_SEASONS ?? 3);
  const count = Number.isFinite(configured) ? Math.min(5, Math.max(1, Math.round(configured))) : 3;
  const current = currentSeasonStart(now);
  return Array.from({ length: count }, (_, index) => current - index);
}

function makeFixtureId(
  season: string,
  leagueCode: string,
  dateKey: string,
  homeName: string,
  awayName: string,
): string {
  return `fduk-${season.replace("/", "")}-${leagueCode.toLowerCase()}-${dateKey.replace(/-/g, "")}-${slugify(homeName)}-${slugify(awayName)}`;
}

function makeTeamId(name: string): string {
  return `fduk-team-${slugify(name)}`;
}

function normalizeRound(round: string | null | undefined): string | null {
  if (!round) return null;
  return round.replace(/^Matchday\s+/i, "Giornata ");
}

function parseIsoDate(value: string): ParsedDate | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function scoreFromOpenFootball(score: z.infer<typeof OF_MATCH_SCHEMA>["score"]): [number, number] | null {
  if (!score) return null;
  if (Array.isArray(score)) {
    return [Math.round(score[0] ?? 0), Math.round(score[1] ?? 0)];
  }
  if (Array.isArray(score.ft)) {
    return [Math.round(score.ft[0] ?? 0), Math.round(score.ft[1] ?? 0)];
  }
  return null;
}

type OddsMode = "pre" | "closing" | "auto";

function oddsValue(
  row: Record<string, string>,
  code: string,
  closing: string,
  selectionSuffix: string,
): number | null {
  const value = numberOrNull(row[`${code}${closing}${selectionSuffix}`]);
  if (value === null || value <= 1.01 || value >= 1000) return null;
  return value;
}

function hasClosingOdds(row: Record<string, string>): boolean {
  const oneXtwo = ["H", "D", "A"].some((suffix) =>
    ODDS_CODES.some((code) => oddsValue(row, code, "C", suffix) !== null),
  );
  const overUnder = [">2.5", "<2.5"].some((suffix) =>
    ODDS_CODES.some((code) => oddsValue(row, code, "C", suffix) !== null),
  );
  return oneXtwo || overUnder;
}

/**
 * Estrae una sintesi di mercato, non tutte le colonne.
 *
 * Per ogni selezione salviamo:
 *  - `BEST`: la quota più alta tra i bookmaker tracciati, con il nome del
 *    bookmaker che la offre;
 *  - `AVG`: la media di mercato (colonna Avg, oppure media dei bookmaker).
 *
 * Salvare tutte le colonne produrrebbe centinaia di migliaia di righe inutili.
 * La UI può così indicare il bookmaker migliore senza inventare nulla.
 */
export function parseOdds(
  fixtureId: string,
  row: Record<string, string>,
  fetchedAt: string,
  mode: OddsMode = "auto",
): OddsQuoteDto[] {
  const result: OddsQuoteDto[] = [];
  const isClosing = mode === "closing" || (mode === "auto" && hasClosingOdds(row));
  const closing = isClosing ? "C" : "";

  const add = (
    marketId: string,
    selectionId: string,
    bookmaker: string,
    bookmakerLabel: string,
    odds: number | null,
  ) => {
    if (odds === null || odds <= 1.01 || odds >= 1000) return;
    const id = `odd-${fixtureId}-${marketId}-${selectionId}-${bookmaker}-${isClosing ? "c" : "p"}`;
    result.push({
      id,
      fixtureId,
      provider: PROVIDER_ID,
      source: SOURCE,
      marketId,
      selectionId,
      bookmaker,
      bookmakerLabel,
      odds,
      isClosing,
      fetchedAt,
    });
  };

  const addSelection = (
    marketId: string,
    selectionId: string,
    suffix: string,
    avgKey: string,
  ) => {
    const named = ODDS_CODES.map((code) => ({
      code,
      label: BOOKMAKERS[code] ?? code,
      odds: oddsValue(row, code, closing, suffix),
    }))
      .filter((item): item is { code: string; label: string; odds: number } => item.odds !== null)
      .sort((left, right) => right.odds - left.odds);
    const best = named[0];
    if (best) {
      add(marketId, selectionId, "BEST", best.label, best.odds);
    } else {
      add(marketId, selectionId, "MAX", "Massimo di mercato", numberOrNull(row[avgKey]));
    }

    const avgSource = numberOrNull(row[avgKey.replace("Max", "Avg")]);
    const avgComputed =
      named.length > 0
        ? named.reduce((sum, item) => sum + item.odds, 0) / named.length
        : null;
    add(
      marketId,
      selectionId,
      "AVG",
      avgSource !== null ? "Media di mercato" : "Media bookmaker",
      avgSource ?? avgComputed,
    );
  };

  addSelection("1X2", "HOME", "H", `Max${closing}H`);
  addSelection("1X2", "DRAW", "D", `Max${closing}D`);
  addSelection("1X2", "AWAY", "A", `Max${closing}A`);
  addSelection("OU25", "OVER", ">2.5", `Max${closing}>2.5`);
  addSelection("OU25", "UNDER", "<2.5", `Max${closing}<2.5`);

  return result;
}

function parseStatistics(
  fixtureId: string,
  row: Record<string, string>,
  fetchedAt: string,
): FixtureStatisticsDto | null {
  const homeXg = numberOrNull(row.HxG);
  const awayXg = numberOrNull(row.AxG);
  const homeShots = integerOrNull(row.HS);
  const awayShots = integerOrNull(row.AS);
  const homeShotsOnTarget = integerOrNull(row.HST);
  const awayShotsOnTarget = integerOrNull(row.AST);
  if (
    homeXg === null &&
    awayXg === null &&
    homeShots === null &&
    awayShots === null &&
    homeShotsOnTarget === null &&
    awayShotsOnTarget === null
  ) {
    return null;
  }
  return {
    fixtureId,
    homeXg,
    awayXg,
    homeShots,
    awayShots,
    homeShotsOnTarget,
    awayShotsOnTarget,
    homePossession: null,
    awayPossession: null,
    source: SOURCE,
    updatedAt: fetchedAt,
  };
}

function mergeOdds(target: Map<string, OddsQuoteDto>, quotes: OddsQuoteDto[]): void {
  for (const quote of quotes) {
    target.set(
      `${quote.marketId}|${quote.selectionId}|${quote.bookmaker}|${quote.isClosing ? 1 : 0}`,
      quote,
    );
  }
}

export class FootballDataUkProvider implements FootballDataProvider {
  readonly id = PROVIDER_ID;
  readonly label = "football-data.co.uk + OpenFootball";
  readonly isDemo = false;
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    results: true,
    standings: true,
    lineups: false,
    probableLineups: false,
    playerAvailability: false,
    matchStatistics: true,
    xg: true,
    players: false,
    historicalMatches: true,
    odds: true,
  };
  readonly limitations = [
    "Calendario e risultati: CSV pubblici di football-data.co.uk; calendario futuro: OpenFootball (CC0).",
    "Quote: solo pre-partita/chiusura presenti nei CSV. Non ci sono quote live e la copertura varia per partita e competizione.",
    "Formazioni, infortuni e squalifiche non sono inclusi: la UI li mostra come non disponibili.",
    "I nomi dei bookmaker sono attribuzione della fonte, senza link, loghi, bonus o inviti al gioco.",
    "La sincronizzazione non è automatica: va eseguita con `npm run sync` o importando lo snapshot incluso.",
  ];
  readonly quotaNote =
    "Nessuna chiave API. File CSV/JSON pubblici, cache locale 6 ore, richieste sequenziali con rate limiter prudente.";

  private readonly limiter = new RateLimiter(45);
  private readonly forceRefresh: boolean;
  private cachedDataset: Promise<Dataset> | null = null;

  constructor() {
    this.forceRefresh = process.env.FOOTBALL_DATA_UK_FORCE === "1";
  }

  private async fetchCached(url: string): Promise<string> {
    const key = `football-data-uk:${url}`;
    if (!this.forceRefresh) {
      const cached = getCache<string>(key);
      if (cached) {
        const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000;
        if (age < cached.ttlSeconds && typeof cached.payload === "string") {
          return cached.payload;
        }
      }
    }
    const text = await fetchText(url, {
      timeoutMs: 25_000,
      retries: 2,
      limiter: this.limiter,
    });
    setCache(key, text, CACHE_TTL_SECONDS, PROVIDER_ID);
    return text;
  }

  private async loadSeason(league: LeagueConfig, startYear: number): Promise<ParsedSeason> {
    const code = seasonCode(startYear);
    const season = seasonLabel(startYear);
    const url = `${BASE_URL}/mmz4281/${code}/${league.code}.csv`;
    try {
      const text = await this.fetchCached(url);
      return { league, season, rows: toObjects(parseCsv(text)) };
    } catch (error) {
      return {
        league,
        season,
        rows: [],
        warning: `${league.name} ${season}: ${(error as Error).message}`,
      };
    }
  }

  private async loadDataset(): Promise<Dataset> {
    if (this.cachedDataset) return this.cachedDataset;
    this.cachedDataset = this.buildDataset();
    return this.cachedDataset;
  }

  private async buildDataset(): Promise<Dataset> {
    const fetchedAt = new Date().toISOString();
    const warnings: string[] = [];
    const starts = historySeasonStarts(new Date());

    // Le stagioni sono caricate dalla più vecchia alla più recente, così i nomi
    // e la competizione corrente hanno la precedenza.
    const seasons = await Promise.all(
      [...starts]
        .reverse()
        .flatMap((startYear) => LEAGUES.map((league) => this.loadSeason(league, startYear))),
    );
    for (const season of seasons) {
      if (season.warning) warnings.push(season.warning);
    }

    const canonicalNames = new Map<string, string[]>();
    for (const league of LEAGUES) {
      const names = new Set<string>();
      for (const season of seasons) {
        if (season.league.code !== league.code) continue;
        for (const row of season.rows) {
          if (row.HomeTeam) names.add(row.HomeTeam.trim());
          if (row.AwayTeam) names.add(row.AwayTeam.trim());
        }
      }
      canonicalNames.set(league.code, [...names].sort((a, b) => b.length - a.length));
    }

    const competitions: CompetitionDto[] = LEAGUES.map((league) => ({
      id: competitionId(league.code),
      name: league.name,
      country: league.country,
      code: league.code,
      tier: league.tier,
      isDemo: false,
    }));

    const matches = new Map<string, InternalMatch>();
    const teams = new Map<string, TeamDto>();

    const registerTeam = (league: LeagueConfig, rawName: string): { id: string; name: string; short: string } => {
      const known = canonicalNames.get(league.code) ?? [];
      const canonical = resolveTeamName(rawName, known);
      if (!known.includes(canonical)) known.push(canonical);
      canonicalNames.set(league.code, known);
      const id = makeTeamId(canonical);
      const existing = teams.get(id);
      if (!existing) {
        teams.set(id, {
          id,
          competitionId: competitionId(league.code),
          name: canonical,
          shortName: canonical.length > 16 ? canonical.split(" ").slice(0, 2).join(" ") : canonical,
          country: league.country,
          color: null,
        });
      } else if (existing.competitionId !== competitionId(league.code)) {
        existing.competitionId = competitionId(league.code);
      }
      return { id, name: canonical, short: canonical };
    };

    const upsert = (incoming: InternalMatch): void => {
      const current = matches.get(incoming.fixture.id);
      if (!current) {
        matches.set(incoming.fixture.id, incoming);
        return;
      }

      // Preferisci il risultato di football-data.co.uk, ma completa i metadati
      // (giornata, orario) con la fonte di calendario.
      if (current.fixture.status !== "FINISHED" && incoming.fixture.status === "FINISHED") {
        current.fixture.status = "FINISHED";
        current.fixture.homeGoals = incoming.fixture.homeGoals;
        current.fixture.awayGoals = incoming.fixture.awayGoals;
      }
      if (!current.fixture.round && incoming.fixture.round) current.fixture.round = incoming.fixture.round;
      if (current.fixture.status !== "FINISHED" && incoming.fixture.kickoffUtc) {
        current.fixture.kickoffUtc = incoming.fixture.kickoffUtc;
      }
      if (!current.statistics && incoming.statistics) current.statistics = incoming.statistics;
      mergeOdds(current.odds, [...incoming.odds.values()]);
      for (const ref of incoming.sourceRefs) current.sourceRefs.add(ref);
      current.fixture.updatedAt = fetchedAt;
    };

    const makeMatch = (
      league: LeagueConfig,
      date: ParsedDate,
      time: string | undefined,
      homeRaw: string,
      awayRaw: string,
      options: {
        season?: string;
        round?: string | null;
        homeGoals?: number | null;
        awayGoals?: number | null;
        status?: FixtureDto["status"];
        sourceRef: string;
        row?: Record<string, string>;
        includeOdds?: boolean;
        oddsMode?: OddsMode;
      },
    ): InternalMatch => {
      const home = registerTeam(league, homeRaw);
      const away = registerTeam(league, awayRaw);
      const season = options.season ?? seasonLabel(startYearFor(date));
      const id = makeFixtureId(season, league.code, date.dateKey, home.name, away.name);
      const finished =
        options.status === "FINISHED" ||
        (options.homeGoals !== null && options.homeGoals !== undefined && options.awayGoals !== null && options.awayGoals !== undefined);
      const fixture: FixtureDto = {
        id,
        competitionId: competitionId(league.code),
        competitionName: league.name,
        competitionCode: league.code,
        season,
        round: options.round ?? null,
        homeTeamId: home.id,
        homeTeamName: home.name,
        homeTeamShort: home.short,
        homeColor: null,
        awayTeamId: away.id,
        awayTeamName: away.name,
        awayTeamShort: away.short,
        awayColor: null,
        kickoffUtc: localKickoffToUtc(date, time, league.timeZone),
        status: finished ? "FINISHED" : (options.status ?? "SCHEDULED"),
        homeGoals: finished ? (options.homeGoals ?? null) : null,
        awayGoals: finished ? (options.awayGoals ?? null) : null,
        venue: null,
        isDemo: false,
        updatedAt: fetchedAt,
      };
      const odds = new Map<string, OddsQuoteDto>();
      if (options.row && options.includeOdds !== false) {
        mergeOdds(odds, parseOdds(id, options.row, fetchedAt, options.oddsMode ?? "auto"));
      }
      return {
        fixture,
        dateKey: date.dateKey,
        odds,
        statistics: options.row ? parseStatistics(id, options.row, fetchedAt) : null,
        sourceRefs: new Set([options.sourceRef]),
      };
    };

    const currentSeason = seasonLabel(currentSeasonStart(new Date()));
    for (const season of seasons) {
      const league = season.league;
      const includeOdds = season.season === currentSeason;
      for (let index = 0; index < season.rows.length; index += 1) {
        const row = season.rows[index]!;
        const date = parseDate(row.Date ?? "");
        if (!date || !row.HomeTeam || !row.AwayTeam) continue;
        const hasResult = row.FTHG !== "" && row.FTAG !== "" && row.FTHG !== undefined && row.FTAG !== undefined;
        upsert(
          makeMatch(league, date, row.Time, row.HomeTeam, row.AwayTeam, {
            season: season.season,
            homeGoals: hasResult ? integerOrNull(row.FTHG) : null,
            awayGoals: hasResult ? integerOrNull(row.FTAG) : null,
            status: hasResult ? "FINISHED" : "SCHEDULED",
            sourceRef: `${SOURCE}/${season.season}/${league.code}/${index + 2}`,
            row,
            includeOdds,
            oddsMode: "auto",
          }),
        );
      }
    }

    // Fixture future/quote della settimana: il file copre un sottoinsieme di
    // campionati, quindi non sostituisce il calendario OpenFootball.
    try {
      const fixturesText = await this.fetchCached(`${BASE_URL}/fixtures.csv`);
      const fixtureRows = toObjects(parseCsv(fixturesText));
      for (let index = 0; index < fixtureRows.length; index += 1) {
        const row = fixtureRows[index]!;
        const league = LEAGUE_BY_CODE.get(row.Div ?? "");
        if (!league) continue;
        const date = parseDate(row.Date ?? "");
        if (!date || !row.HomeTeam || !row.AwayTeam) continue;
        const incoming = makeMatch(league, date, row.Time, row.HomeTeam, row.AwayTeam, {
          status: "SCHEDULED",
          sourceRef: `${SOURCE}/fixtures.csv/${index + 2}`,
          row,
          includeOdds: date.dateKey >= new Date().toISOString().slice(0, 10),
          oddsMode: "pre",
        });
        upsert(incoming);
      }
    } catch (error) {
      warnings.push(`fixtures.csv: ${(error as Error).message}`);
    }

    // Calendario completo della stagione corrente da OpenFootball (CC0).
    // Viene usato soprattutto per le partite future, che i CSV di risultati
    // non contengono.
    const openFootballStart = currentSeasonStart(new Date());
    const openFootballSeason = seasonCode(openFootballStart);
    const openFootballFolder = `${openFootballStart}-${String((openFootballStart + 1) % 100).padStart(2, "0")}`;
    await Promise.all(
      LEAGUES.filter((league) => league.openFootballPath).map(async (league) => {
        const url = `${OPEN_FOOTBALL_BASE}/${openFootballFolder}/${league.openFootballPath}`;
        try {
          const text = await this.fetchCached(url);
          const parsed = OF_FILE_SCHEMA.parse(JSON.parse(text));
          for (const match of parsed.matches) {
            const date = parseIsoDate(match.date);
            if (!date) continue;
            const score = scoreFromOpenFootball(match.score);
            const incoming = makeMatch(league, date, match.time ?? undefined, match.team1, match.team2, {
              round: normalizeRound(match.round),
              status: score ? "FINISHED" : "SCHEDULED",
              homeGoals: score ? score[0] : null,
              awayGoals: score ? score[1] : null,
              sourceRef: `OpenFootball/${openFootballSeason}/${league.openFootballPath}`,
            });
            upsert(incoming);
          }
        } catch (error) {
          warnings.push(`OpenFootball ${league.name}: ${(error as Error).message}`);
        }
      }),
    );

    const internalMatches = [...matches.values()].sort(
      (left, right) => left.fixture.kickoffUtc.localeCompare(right.fixture.kickoffUtc),
    );
    const odds = [...new Set(internalMatches.flatMap((match) => [...match.odds.values()]))];
    const statistics = internalMatches
      .map((match) => match.statistics)
      .filter((value): value is FixtureStatisticsDto => value !== null);

    if (internalMatches.length === 0) {
      throw new Error(
        `Nessuna partita recuperata dalle fonti pubbliche. ${warnings.join(" | ")}`.trim(),
      );
    }

    return {
      competitions,
      teams: [...teams.values()].sort((left, right) => left.name.localeCompare(right.name)),
      matches: internalMatches,
      odds,
      statistics,
      warnings,
      fetchedAt,
    };
  }

  async getSyncBundle(): Promise<ProviderResult<ProviderSyncBundle>> {
    try {
      const dataset = await this.loadDataset();
      return ok(
        this.id,
        {
          competitions: dataset.competitions,
          teams: dataset.teams,
          fixtures: dataset.matches.map((match) => match.fixture),
          statistics: dataset.statistics,
          odds: dataset.odds,
        },
        dataset.warnings.length > 0 ? dataset.warnings.join(" | ") : undefined,
      );
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getCompetitions(): Promise<ProviderResult<CompetitionDto[]>> {
    try {
      const dataset = await this.loadDataset();
      return ok(this.id, dataset.competitions, dataset.warnings[0]);
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getFixtures(query: FixtureQuery): Promise<ProviderResult<FixtureDto[]>> {
    try {
      const dataset = await this.loadDataset();
      const codes = query.competitionCodes?.length
        ? new Set(query.competitionCodes.map((code) => code.toUpperCase()))
        : null;
      const fixtures = dataset.matches
        .map((match) => match.fixture)
        .filter(
          (fixture) =>
            fixture.kickoffUtc >= query.from &&
            fixture.kickoffUtc <= query.to &&
            (!codes || codes.has(fixture.competitionCode)),
        );
      return ok(this.id, fixtures);
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getFixtureDetails(id: string): Promise<ProviderResult<FixtureDto>> {
    try {
      const dataset = await this.loadDataset();
      const found = dataset.matches.find((match) => match.fixture.id === id);
      if (!found) return unavailable(this.id, "Partita non presente nelle fonti configurate.");
      return ok(this.id, found.fixture);
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getHistoricalMatches(
    competitionIdValue: string,
    from: string,
    to: string,
  ): Promise<ProviderResult<FixtureDto[]>> {
    try {
      const dataset = await this.loadDataset();
      const code = competitionIdValue.replace(/^fduk-/, "").toUpperCase();
      const fixtures = dataset.matches
        .map((match) => match.fixture)
        .filter(
          (fixture) =>
            fixture.competitionCode === code &&
            fixture.status === "FINISHED" &&
            fixture.kickoffUtc >= from &&
            fixture.kickoffUtc <= to,
        );
      return ok(this.id, fixtures);
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getTeams(competitionIdValue: string): Promise<ProviderResult<TeamDto[]>> {
    try {
      const dataset = await this.loadDataset();
      return ok(
        this.id,
        dataset.teams.filter((team) => team.competitionId === competitionIdValue),
      );
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }

  async getTeamStatistics(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(
      this.id,
      "Le statistiche aggregate sono calcolate nel layer applicativo dai risultati importati.",
    );
  }

  async getTeamPlayers(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "La fonte pubblica non include rose e giocatori.");
  }

  async getPlayerAvailability(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(
      this.id,
      "Infortuni e squalifiche non sono inclusi nella fonte pubblica. Nessun dato viene inventato.",
    );
  }

  async getProbableLineups(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Probabili formazioni non incluse nella fonte pubblica.");
  }

  async getOfficialLineups(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Formazioni ufficiali non incluse nella fonte pubblica.");
  }

  async getFixtureStatistics(fixtureId: string): Promise<ProviderResult<FixtureStatisticsDto>> {
    try {
      const dataset = await this.loadDataset();
      const stats = dataset.statistics.find((item) => item.fixtureId === fixtureId);
      if (!stats) return unavailable(this.id, "Statistiche non disponibili per questa partita.");
      return ok(this.id, stats);
    } catch (error) {
      return unavailable(this.id, (error as Error).message);
    }
  }
}
