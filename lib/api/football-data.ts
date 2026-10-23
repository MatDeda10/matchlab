import { z } from "zod";
import type {
  CompetitionDto,
  FixtureDto,
  FixtureStatus,
  TeamDto,
} from "@/lib/db/types";
import { getCache, setCache } from "@/lib/db/repositories";
import { fetchJson, RateLimiter } from "./http";
import {
  ok,
  unavailable,
  type FixtureQuery,
  type FootballDataProvider,
  type ProviderCapabilities,
  type ProviderResult,
} from "./provider";

const BASE_URL = "https://api.football-data.org/v4";
const CACHE_TTL_SECONDS = 6 * 60 * 60;

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullish(),
  crest: z.string().nullish(),
});

const matchSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  matchday: z.number().nullish(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: z
    .object({
      fullTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
    })
    .nullish(),
});

const matchesResponseSchema = z.object({
  matches: z.array(matchSchema),
});

const competitionsResponseSchema = z.object({
  competitions: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      code: z.string(),
      area: z.object({ name: z.string().nullish() }).nullish(),
      emblem: z.string().nullish(),
    }),
  ),
});

const matchDetailSchema = matchSchema.extend({
  competition: z.object({ code: z.string(), name: z.string() }),
});

type RawMatch = z.infer<typeof matchSchema>;

function mapStatus(status: string): FixtureStatus {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
      return "IN_PLAY";
    case "FINISHED":
    case "AWARDED":
      return "FINISHED";
    case "POSTPONED":
    case "SUSPENDED":
      return "POSTPONED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "SCHEDULED";
  }
}

function seasonLabel(utcDate: string): string {
  const date = new Date(utcDate);
  const year = date.getUTCFullYear();
  const start = date.getUTCMonth() >= 6 ? year : year - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function competitionId(code: string): string {
  return `fd-${code.toLowerCase()}`;
}

function teamId(id: number): string {
  return `fd-team-${id}`;
}

function normalizeMatch(
  match: RawMatch,
  competition: { code: string; name: string },
): FixtureDto {
  const finished = mapStatus(match.status) === "FINISHED";
  const homeGoals = match.score?.fullTime.home ?? null;
  const awayGoals = match.score?.fullTime.away ?? null;
  return {
    id: `fd-${match.id}`,
    competitionId: competitionId(competition.code),
    competitionName: competition.name,
    competitionCode: competition.code,
    season: seasonLabel(match.utcDate),
    round: match.matchday ? `Giornata ${match.matchday}` : null,
    homeTeamId: teamId(match.homeTeam.id),
    homeTeamName: match.homeTeam.name,
    homeTeamShort: match.homeTeam.shortName ?? match.homeTeam.name,
    homeColor: null,
    awayTeamId: teamId(match.awayTeam.id),
    awayTeamName: match.awayTeam.name,
    awayTeamShort: match.awayTeam.shortName ?? match.awayTeam.name,
    awayColor: null,
    kickoffUtc: match.utcDate,
    status: mapStatus(match.status),
    homeGoals: finished ? homeGoals : null,
    awayGoals: finished ? awayGoals : null,
    venue: null,
    isDemo: false,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Adapter per football-data.org (v4).
 *
 * Fatti verificati sulla pagina prezzi ufficiale (ottobre 2026):
 * - piano Free: 0 €/mese, 12 competizioni, 10 richieste/minuto;
 * - punteggi e calendari ritardati;
 * - formazioni, rose e dati avanzati NON sono inclusi nel piano Free.
 *
 * L'adapter non presume endpoint aggiuntivi: quelli non supportati restituiscono
 * esplicitamente UNAVAILABLE. La copertura storica gratuita varia per competizione
 * e va verificata con la propria chiave.
 */
export class FootballDataOrgProvider implements FootballDataProvider {
  readonly id = "football-data";
  readonly label = "football-data.org";
  readonly isDemo = false;
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    results: true,
    standings: true,
    lineups: false,
    probableLineups: false,
    playerAvailability: false,
    matchStatistics: false,
    xg: false,
    players: false,
    historicalMatches: true,
    odds: false,
  };
  readonly limitations = [
    "Piano gratuito: 12 competizioni e 10 richieste/minuto (fonte: pagina prezzi ufficiale).",
    "Punteggi e calendari possono essere ritardati nel piano gratuito.",
    "Formazioni, rose, infortuni e statistiche avanzate non sono disponibili: la UI lo dichiara.",
    "La copertura storica gratuita dipende dalla competizione e dalle condizioni del provider.",
  ];
  readonly quotaNote =
    "10 richieste/minuto; il client applica un rate limiter conservativo e una cache di 6 ore.";

  private readonly apiKey: string;
  private readonly competitionCodes: string[];
  private readonly limiter = new RateLimiter(8);

  constructor(apiKey: string, competitionCodes: string[]) {
    this.apiKey = apiKey;
    this.competitionCodes = competitionCodes;
  }

  private headers(): Record<string, string> {
    return { "X-Auth-Token": this.apiKey };
  }

  private async getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const cached = getCache<unknown>(`football-data:${url}`);
    if (cached) {
      const age = (Date.now() - new Date(cached.fetchedAt).getTime()) / 1000;
      if (age < cached.ttlSeconds) {
        const parsed = schema.safeParse(cached.payload);
        if (parsed.success) return parsed.data;
      }
    }
    const raw = await fetchJson<unknown>(url, {
      headers: this.headers(),
      timeoutMs: 12_000,
      retries: 2,
      limiter: this.limiter,
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Risposta API non conforme allo schema atteso: ${parsed.error.issues[0]?.message ?? "errore sconosciuto"}`,
      );
    }
    setCache(`football-data:${url}`, parsed.data, CACHE_TTL_SECONDS, this.id);
    return parsed.data;
  }

  private competitionName(code: string): string {
    const names: Record<string, string> = {
      SA: "Serie A",
      PL: "Premier League",
      PD: "La Liga",
      BL1: "Bundesliga",
      FL1: "Ligue 1",
      DED: "Eredivisie",
      PPL: "Primeira Liga",
      BSA: "Brasileirão",
      CL: "UEFA Champions League",
      EC: "European Championship",
      WC: "FIFA World Cup",
      CLI: "Copa Libertadores",
    };
    return names[code] ?? code;
  }

  async getCompetitions(): Promise<ProviderResult<CompetitionDto[]>> {
    try {
      const response = await this.getJson(
        `${BASE_URL}/competitions`,
        competitionsResponseSchema,
      );
      const selected = response.competitions.filter((competition) =>
        this.competitionCodes.includes(competition.code),
      );
      if (selected.length === 0) {
        return unavailable(
          this.id,
          `Nessuna delle competizioni configurate (${this.competitionCodes.join(", ")}) è presente nella risposta del provider.`,
        );
      }
      return ok(
        this.id,
        selected.map((competition) => ({
          id: competitionId(competition.code),
          name: competition.name,
          country: competition.area?.name ?? "—",
          code: competition.code,
          tier: 1,
          isDemo: false,
        })),
      );
    } catch (error) {
      return unavailable(this.id, `Impossibile leggere le competizioni: ${(error as Error).message}`);
    }
  }

  async getFixtures(query: FixtureQuery): Promise<ProviderResult<FixtureDto[]>> {
    const codes = query.competitionCodes?.length ? query.competitionCodes : this.competitionCodes;
    const fixtures: FixtureDto[] = [];
    const errors: string[] = [];
    for (const code of codes) {
      try {
        const url = `${BASE_URL}/competitions/${encodeURIComponent(code)}/matches?dateFrom=${query.from}&dateTo=${query.to}`;
        const response = await this.getJson(url, matchesResponseSchema);
        const competition = { code, name: this.competitionName(code) };
        fixtures.push(...response.matches.map((match) => normalizeMatch(match, competition)));
      } catch (error) {
        errors.push(`${code}: ${(error as Error).message}`);
      }
    }
    if (fixtures.length === 0) {
      return unavailable(this.id, `Nessuna partita recuperata. ${errors.join(" | ")}`.trim());
    }
    return ok(this.id, fixtures, errors.length > 0 ? errors.join(" | ") : undefined);
  }

  async getHistoricalMatches(
    competitionIdValue: string,
    from: string,
    to: string,
  ): Promise<ProviderResult<FixtureDto[]>> {
    const code = competitionIdValue.replace(/^fd-/, "").toUpperCase();
    return this.getFixtures({ from, to, competitionCodes: [code] });
  }

  async getFixtureDetails(id: string): Promise<ProviderResult<FixtureDto>> {
    try {
      const numericId = Number(id.replace(/^fd-/, ""));
      if (!Number.isFinite(numericId)) return unavailable(this.id, "Identificativo partita non valido.");
      const match = await this.getJson(`${BASE_URL}/matches/${numericId}`, matchDetailSchema);
      return ok(this.id, normalizeMatch(match, match.competition));
    } catch (error) {
      return unavailable(this.id, `Dettaglio partita non disponibile: ${(error as Error).message}`);
    }
  }

  async getTeams(_competitionId: string): Promise<ProviderResult<TeamDto[]>> {
    return unavailable(
      this.id,
      "Il piano gratuito non espone un elenco completo delle squadre per competizione tramite un endpoint dedicato utilizzabile in modo affidabile.",
    );
  }

  async getTeamStatistics(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Statistiche di squadra non incluse nel piano gratuito.");
  }

  async getTeamPlayers(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Rose e giocatori non inclusi nel piano gratuito.");
  }

  async getPlayerAvailability(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(
      this.id,
      "Infortuni/squalifiche non inclusi: richiedono un piano con dati avanzati. Nessun dato viene inventato.",
    );
  }

  async getProbableLineups(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Probabili formazioni non incluse nel piano gratuito.");
  }

  async getOfficialLineups(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Formazioni ufficiali non incluse nel piano gratuito.");
  }

  async getFixtureStatistics(_fixtureId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Statistiche di partita non incluse nel piano gratuito.");
  }
}
