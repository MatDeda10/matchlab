import { randomUUID } from "node:crypto";
import { all, get, run, transaction } from "./index";
import type {
  AvailabilityDto,
  CompetitionDto,
  FixtureDto,
  FixtureStatisticsDto,
  FixtureStatus,
  LineupDto,
  PredictionDto,
  PredictionLegDto,
  PreferencesDto,
  ScenarioDto,
  StandingsRow,
  TeamDto,
} from "./types";
import type { HistoricalMatch } from "@/engine/types";

interface FixtureQueryRow {
  id: string;
  competition_id: string;
  competition_name: string;
  competition_code: string;
  season: string;
  round: string | null;
  home_team_id: string;
  home_team_name: string;
  home_team_short: string;
  home_color: string | null;
  away_team_id: string;
  away_team_name: string;
  away_team_short: string;
  away_color: string | null;
  kickoff_utc: string;
  status: FixtureStatus;
  home_goals: number | null;
  away_goals: number | null;
  venue: string | null;
  is_demo: number;
  updated_at: string;
}

const FIXTURE_SELECT = `
  SELECT f.id, f.competition_id, c.name AS competition_name, c.code AS competition_code,
         f.season, f.round,
         f.home_team_id, h.name AS home_team_name, h.short_name AS home_team_short, h.color AS home_color,
         f.away_team_id, a.name AS away_team_name, a.short_name AS away_team_short, a.color AS away_color,
         f.kickoff_utc, f.status, f.home_goals, f.away_goals, f.venue, f.is_demo, f.updated_at
  FROM fixtures f
  JOIN competitions c ON c.id = f.competition_id
  JOIN teams h ON h.id = f.home_team_id
  JOIN teams a ON a.id = f.away_team_id
`;

function mapFixture(row: FixtureQueryRow): FixtureDto {
  return {
    id: row.id,
    competitionId: row.competition_id,
    competitionName: row.competition_name,
    competitionCode: row.competition_code,
    season: row.season,
    round: row.round,
    homeTeamId: row.home_team_id,
    homeTeamName: row.home_team_name,
    homeTeamShort: row.home_team_short,
    homeColor: row.home_color,
    awayTeamId: row.away_team_id,
    awayTeamName: row.away_team_name,
    awayTeamShort: row.away_team_short,
    awayColor: row.away_color,
    kickoffUtc: row.kickoff_utc,
    status: row.status,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    venue: row.venue,
    isDemo: row.is_demo === 1,
    updatedAt: row.updated_at,
  };
}

export function listCompetitions(): CompetitionDto[] {
  return all<{
    id: string;
    name: string;
    country: string;
    code: string;
    tier: number;
    provider: string;
  }>("SELECT id, name, country, code, tier, provider FROM competitions ORDER BY tier, name").map(
    (row) => ({
      id: row.id,
      name: row.name,
      country: row.country,
      code: row.code,
      tier: row.tier,
      isDemo: row.provider === "demo",
    }),
  );
}

export function getCompetition(id: string): CompetitionDto | null {
  return listCompetitions().find((competition) => competition.id === id) ?? null;
}

export interface FixtureFilter {
  from?: string;
  to?: string;
  competitionIds?: string[];
  teamId?: string;
  statuses?: FixtureStatus[];
  search?: string;
  limit?: number;
  order?: "asc" | "desc";
}

export function listFixtures(filter: FixtureFilter = {}): FixtureDto[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filter.from) {
    where.push("f.kickoff_utc >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    where.push("f.kickoff_utc <= ?");
    params.push(filter.to);
  }
  if (filter.competitionIds && filter.competitionIds.length > 0) {
    where.push(`f.competition_id IN (${filter.competitionIds.map(() => "?").join(",")})`);
    params.push(...filter.competitionIds);
  }
  if (filter.teamId) {
    where.push("(f.home_team_id = ? OR f.away_team_id = ?)");
    params.push(filter.teamId, filter.teamId);
  }
  if (filter.statuses && filter.statuses.length > 0) {
    where.push(`f.status IN (${filter.statuses.map(() => "?").join(",")})`);
    params.push(...filter.statuses);
  }
  if (filter.search?.trim()) {
    where.push("(LOWER(h.name) LIKE ? OR LOWER(a.name) LIKE ?)");
    const term = `%${filter.search.trim().toLowerCase()}%`;
    params.push(term, term);
  }
  const order = filter.order === "desc" ? "DESC" : "ASC";
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);
  const sql = `${FIXTURE_SELECT}
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY f.kickoff_utc ${order}
    LIMIT ${limit}`;
  return all<FixtureQueryRow>(sql, ...params).map(mapFixture);
}

export function getFixture(id: string): FixtureDto | null {
  const row = get<FixtureQueryRow>(`${FIXTURE_SELECT} WHERE f.id = ?`, id);
  return row ? mapFixture(row) : null;
}

export function listTeams(competitionId?: string): TeamDto[] {
  const rows = competitionId
    ? all<{
        id: string;
        competition_id: string;
        name: string;
        short_name: string;
        country: string;
        color: string | null;
      }>(
        "SELECT id, competition_id, name, short_name, country, color FROM teams WHERE competition_id = ? ORDER BY name",
        competitionId,
      )
    : all<{
        id: string;
        competition_id: string;
        name: string;
        short_name: string;
        country: string;
        color: string | null;
      }>("SELECT id, competition_id, name, short_name, country, color FROM teams ORDER BY name");
  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    name: row.name,
    shortName: row.short_name,
    country: row.country,
    color: row.color,
  }));
}

export function getTeam(id: string): TeamDto | null {
  return listTeams().find((team) => team.id === id) ?? null;
}

export function listFinishedMatches(
  competitionId?: string,
  before?: string,
): HistoricalMatch[] {
  const where = ["f.status = 'FINISHED'", "f.home_goals IS NOT NULL", "f.away_goals IS NOT NULL"];
  const params: string[] = [];
  if (competitionId) {
    where.push("f.competition_id = ?");
    params.push(competitionId);
  }
  if (before) {
    where.push("f.kickoff_utc < ?");
    params.push(before);
  }
  const rows = all<{
    id: string;
    competition_id: string;
    home_team_id: string;
    away_team_id: string;
    kickoff_utc: string;
    home_goals: number;
    away_goals: number;
    home_xg: number | null;
    away_xg: number | null;
  }>(
    `SELECT f.id, f.competition_id, f.home_team_id, f.away_team_id, f.kickoff_utc,
            f.home_goals, f.away_goals, s.home_xg, s.away_xg
     FROM fixtures f
     LEFT JOIN fixture_statistics s ON s.fixture_id = f.id
     WHERE ${where.join(" AND ")}
     ORDER BY f.kickoff_utc DESC`,
    ...params,
  );
  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competition_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    kickoff: row.kickoff_utc,
    homeGoals: row.home_goals,
    awayGoals: row.away_goals,
    homeXg: row.home_xg,
    awayXg: row.away_xg,
  }));
}

export function getFixtureStatistics(fixtureId: string): FixtureStatisticsDto | null {
  const row = get<{
    fixture_id: string;
    home_xg: number | null;
    away_xg: number | null;
    home_shots: number | null;
    away_shots: number | null;
    home_shots_on_target: number | null;
    away_shots_on_target: number | null;
    home_possession: number | null;
    away_possession: number | null;
    source: string;
    updated_at: string;
  }>("SELECT * FROM fixture_statistics WHERE fixture_id = ?", fixtureId);
  if (!row) return null;
  return {
    fixtureId: row.fixture_id,
    homeXg: row.home_xg,
    awayXg: row.away_xg,
    homeShots: row.home_shots,
    awayShots: row.away_shots,
    homeShotsOnTarget: row.home_shots_on_target,
    awayShotsOnTarget: row.away_shots_on_target,
    homePossession: row.home_possession,
    awayPossession: row.away_possession,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export function getLineups(fixtureId: string): LineupDto[] {
  const lineups = all<{
    fixture_id: string;
    team_id: string;
    kind: LineupDto["kind"];
    formation: string | null;
    source: string;
    updated_at: string;
  }>("SELECT fixture_id, team_id, kind, formation, source, updated_at FROM lineups WHERE fixture_id = ?", fixtureId);

  return lineups.map((lineup) => {
    const players = all<{
      id: string;
      player_id: string | null;
      player_name: string;
      role: string;
      slot: number;
      is_starter: number;
      status: string;
      shirt_number: number | null;
    }>(
      "SELECT id, player_id, player_name, role, slot, is_starter, status, shirt_number FROM lineup_players WHERE fixture_id = ? AND team_id = ? ORDER BY slot",
      fixtureId,
      lineup.team_id,
    ).map((player) => ({
      id: player.id,
      playerId: player.player_id,
      playerName: player.player_name,
      role: player.role,
      slot: player.slot,
      isStarter: player.is_starter === 1,
      status: player.status,
      shirtNumber: player.shirt_number,
    }));
    return {
      fixtureId: lineup.fixture_id,
      teamId: lineup.team_id,
      kind: lineup.kind,
      formation: lineup.formation,
      source: lineup.source,
      updatedAt: lineup.updated_at,
      players,
    };
  });
}

export function getAvailability(fixtureId: string): AvailabilityDto[] {
  return all<{
    id: string;
    fixture_id: string;
    team_id: string;
    player_id: string | null;
    player_name: string;
    status: AvailabilityDto["status"];
    reason: string | null;
    source: string;
    confidence: number | null;
    updated_at: string;
  }>(
    "SELECT id, fixture_id, team_id, player_id, player_name, status, reason, source, confidence, updated_at FROM player_availability WHERE fixture_id = ? ORDER BY status, player_name",
    fixtureId,
  ).map((row) => ({
    id: row.id,
    fixtureId: row.fixture_id,
    teamId: row.team_id,
    playerId: row.player_id,
    playerName: row.player_name,
    status: row.status,
    reason: row.reason,
    source: row.source,
    confidence: row.confidence,
    updatedAt: row.updated_at,
  }));
}

export function getLastMatchDate(teamId: string, before: string): string | null {
  const row = get<{ kickoff_utc: string }>(
    `SELECT kickoff_utc FROM fixtures
     WHERE status = 'FINISHED' AND kickoff_utc < ? AND (home_team_id = ? OR away_team_id = ?)
     ORDER BY kickoff_utc DESC LIMIT 1`,
    before,
    teamId,
    teamId,
  );
  return row?.kickoff_utc ?? null;
}

export function getStandings(competitionId: string): StandingsRow[] {
  const latest = get<{ season: string }>(
    "SELECT season FROM fixtures WHERE competition_id = ? ORDER BY kickoff_utc DESC LIMIT 1",
    competitionId,
  );
  const teams = listTeams(competitionId);
  if (!latest) return [];
  const fixtures = all<{
    home_team_id: string;
    away_team_id: string;
    home_goals: number;
    away_goals: number;
    kickoff_utc: string;
  }>(
    `SELECT home_team_id, away_team_id, home_goals, away_goals, kickoff_utc
     FROM fixtures
     WHERE competition_id = ? AND season = ? AND status = 'FINISHED'
       AND home_goals IS NOT NULL AND away_goals IS NOT NULL
     ORDER BY kickoff_utc ASC`,
    competitionId,
    latest.season,
  );

  const table = new Map<
    string,
    Omit<StandingsRow, "position" | "teamName" | "shortName" | "goalDifference" | "form"> & {
      form: Array<"W" | "D" | "L">;
    }
  >();
  for (const team of teams) {
    table.set(team.id, {
      teamId: team.id,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [],
    });
  }
  for (const fixture of fixtures) {
    const home = table.get(fixture.home_team_id);
    const away = table.get(fixture.away_team_id);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.home_goals;
    home.goalsAgainst += fixture.away_goals;
    away.goalsFor += fixture.away_goals;
    away.goalsAgainst += fixture.home_goals;
    if (fixture.home_goals > fixture.away_goals) {
      home.won += 1; home.points += 3; away.lost += 1;
      home.form.push("W"); away.form.push("L");
    } else if (fixture.home_goals < fixture.away_goals) {
      away.won += 1; away.points += 3; home.lost += 1;
      away.form.push("W"); home.form.push("L");
    } else {
      home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1;
      home.form.push("D"); away.form.push("D");
    }
  }

  return [...table.values()]
    .map((row) => ({
      ...row,
      form: row.form.slice(-5),
      goalDifference: row.goalsFor - row.goalsAgainst,
      teamName: teams.find((team) => team.id === row.teamId)?.name ?? row.teamId,
      shortName: teams.find((team) => team.id === row.teamId)?.shortName ?? row.teamId,
      position: 0,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.teamName.localeCompare(b.teamName),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function getPreferences(sessionId: string): PreferencesDto {
  const row = get<{
    session_id: string;
    theme: PreferencesDto["theme"];
    timezone: string;
    locale: string;
    favorite_competitions: string;
    default_profile: string;
    interface_prefs: string;
    updated_at: string;
  }>("SELECT * FROM preferences WHERE session_id = ?", sessionId);
  if (!row) {
    return {
      sessionId,
      theme: "dark",
      timezone: "Europe/Rome",
      locale: "it",
      favoriteCompetitions: [],
      defaultProfile: "balanced",
      interfacePrefs: {},
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    sessionId: row.session_id,
    theme: row.theme,
    timezone: row.timezone,
    locale: row.locale,
    favoriteCompetitions: safeJson<string[]>(row.favorite_competitions, []),
    defaultProfile: row.default_profile,
    interfacePrefs: safeJson<Record<string, unknown>>(row.interface_prefs, {}),
    updatedAt: row.updated_at,
  };
}

export function savePreferences(
  sessionId: string,
  input: Partial<Omit<PreferencesDto, "sessionId" | "updatedAt">>,
): PreferencesDto {
  const current = getPreferences(sessionId);
  const merged = { ...current, ...input, updatedAt: new Date().toISOString() };
  run(
    `INSERT INTO preferences (session_id, theme, timezone, locale, favorite_competitions, default_profile, interface_prefs, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       theme = excluded.theme,
       timezone = excluded.timezone,
       locale = excluded.locale,
       favorite_competitions = excluded.favorite_competitions,
       default_profile = excluded.default_profile,
       interface_prefs = excluded.interface_prefs,
       updated_at = excluded.updated_at`,
    sessionId,
    merged.theme,
    merged.timezone,
    merged.locale,
    JSON.stringify(merged.favoriteCompetitions),
    merged.defaultProfile,
    JSON.stringify(merged.interfacePrefs),
    merged.updatedAt,
  );
  return getPreferences(sessionId);
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface CreatePredictionInput {
  sessionId: string;
  kickoffMin: string | null;
  modelVersion: string;
  dataQuality: number;
  isDemo?: boolean;
  snapshot: unknown;
  legs: Array<{
    fixtureId: string;
    competitionId: string;
    marketId: string;
    selectionId: string;
    probability: number;
    quality: number;
  }>;
}

export function createPrediction(input: CreatePredictionInput): string {
  const id = `pred-${randomUUID()}`;
  const now = new Date().toISOString();
  transaction(() => {
    run(
      `INSERT INTO predictions (id, session_id, created_at, kickoff_min, status, outcome, model_version, data_quality, is_demo, snapshot_json, settled_at, exclusion_reason)
       VALUES (?, ?, ?, ?, 'OPEN', NULL, ?, ?, ?, ?, NULL, NULL)`,
      id,
      input.sessionId,
      now,
      input.kickoffMin,
      input.modelVersion,
      input.dataQuality,
      input.isDemo ? 1 : 0,
      JSON.stringify(input.snapshot),
    );
    for (const leg of input.legs) {
      run(
        `INSERT INTO prediction_legs (id, prediction_id, fixture_id, competition_id, market_id, selection_id, probability, quality, actual_won)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        `leg-${randomUUID()}`,
        id,
        leg.fixtureId,
        leg.competitionId,
        leg.marketId,
        leg.selectionId,
        leg.probability,
        leg.quality,
      );
    }
  });
  return id;
}

export function listPredictions(sessionId: string, includeDemo = false): PredictionDto[] {
  const rows = all<{
    id: string;
    session_id: string;
    created_at: string;
    kickoff_min: string | null;
    status: PredictionDto["status"];
    outcome: PredictionDto["outcome"];
    model_version: string;
    data_quality: number;
    is_demo: number;
    snapshot_json: string;
    settled_at: string | null;
  }>(
    includeDemo
      ? "SELECT * FROM predictions WHERE session_id = ? OR is_demo = 1 ORDER BY created_at DESC LIMIT 300"
      : "SELECT * FROM predictions WHERE session_id = ? ORDER BY created_at DESC LIMIT 300",
    sessionId,
  );

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    kickoffMin: row.kickoff_min,
    status: row.status,
    outcome: row.outcome,
    modelVersion: row.model_version,
    dataQuality: row.data_quality,
    isDemo: row.is_demo === 1,
    snapshot: safeJson<unknown>(row.snapshot_json, null),
    settledAt: row.settled_at,
    legs: all<{
      id: string;
      fixture_id: string;
      competition_id: string;
      market_id: string;
      selection_id: string;
      probability: number;
      quality: number;
      actual_won: number | null;
    }>(
      "SELECT id, fixture_id, competition_id, market_id, selection_id, probability, quality, actual_won FROM prediction_legs WHERE prediction_id = ?",
      row.id,
    ).map<PredictionLegDto>((leg) => ({
      id: leg.id,
      fixtureId: leg.fixture_id,
      competitionId: leg.competition_id,
      marketId: leg.market_id,
      selectionId: leg.selection_id,
      probability: leg.probability,
      quality: leg.quality,
      actualWon: leg.actual_won === null ? null : leg.actual_won === 1,
    })),
  }));
}

export function settlePrediction(
  predictionId: string,
  sessionId: string,
  legs: Array<{ legId: string; won: boolean | null }>,
): boolean {
  const prediction = get<{ id: string; session_id: string; is_demo: number }>(
    "SELECT id, session_id, is_demo FROM predictions WHERE id = ?",
    predictionId,
  );
  if (!prediction) return false;
  if (prediction.session_id !== sessionId && prediction.is_demo !== 1) return false;

  const now = new Date().toISOString();
  transaction(() => {
    for (const leg of legs) {
      run(
        "UPDATE prediction_legs SET actual_won = ? WHERE id = ? AND prediction_id = ?",
        leg.won === null ? null : leg.won ? 1 : 0,
        leg.legId,
        predictionId,
      );
    }
    const current = all<{ actual_won: number | null }>(
      "SELECT actual_won FROM prediction_legs WHERE prediction_id = ?",
      predictionId,
    );
    if (current.length === 0 || current.some((leg) => leg.actual_won === null)) return;
    const won = current.every((leg) => leg.actual_won === 1);
    const voided = current.every((leg) => leg.actual_won === null);
    run(
      "UPDATE predictions SET status = ?, outcome = ?, settled_at = ? WHERE id = ?",
      voided ? "VOID" : "SETTLED",
      voided ? "VOID" : won ? "WON" : "LOST",
      now,
      predictionId,
    );
  });
  return true;
}

export function cancelPrediction(predictionId: string, sessionId: string): boolean {
  const now = new Date().toISOString();
  const result = run(
    "UPDATE predictions SET status = 'VOID', outcome = 'VOID', settled_at = ? WHERE id = ? AND session_id = ? AND status = 'OPEN' AND (kickoff_min IS NULL OR kickoff_min > ?)",
    now,
    predictionId,
    sessionId,
    now,
  );
  return Number(result.changes) > 0;
}

export interface CreateScenarioInput {
  sessionId: string;
  name: string;
  modelVersion: string;
  config: unknown;
  result: unknown;
  isDemo?: boolean;
}

export function createScenario(input: CreateScenarioInput): string {
  const id = `scn-${randomUUID()}`;
  run(
    `INSERT INTO scenarios (id, session_id, name, created_at, model_version, config_json, result_json, is_demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.sessionId,
    input.name.trim().slice(0, 80) || "Scenario senza nome",
    new Date().toISOString(),
    input.modelVersion,
    JSON.stringify(input.config),
    JSON.stringify(input.result),
    input.isDemo ? 1 : 0,
  );
  return id;
}

export function listScenarios(sessionId: string): ScenarioDto[] {
  return all<{
    id: string;
    session_id: string;
    name: string;
    created_at: string;
    model_version: string;
    config_json: string;
    result_json: string;
    is_demo: number;
  }>("SELECT * FROM scenarios WHERE session_id = ? ORDER BY created_at DESC LIMIT 100", sessionId).map(
    (row) => ({
      id: row.id,
      sessionId: row.session_id,
      name: row.name,
      createdAt: row.created_at,
      modelVersion: row.model_version,
      config: safeJson<unknown>(row.config_json, null),
      result: safeJson<unknown>(row.result_json, null),
      isDemo: row.is_demo === 1,
    }),
  );
}

export function getScenariosByIds(sessionId: string, ids: string[]): ScenarioDto[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return all<{
    id: string;
    session_id: string;
    name: string;
    created_at: string;
    model_version: string;
    config_json: string;
    result_json: string;
    is_demo: number;
  }>(
    `SELECT * FROM scenarios WHERE session_id = ? AND id IN (${placeholders})`,
    sessionId,
    ...ids,
  ).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    createdAt: row.created_at,
    modelVersion: row.model_version,
    config: safeJson<unknown>(row.config_json, null),
    result: safeJson<unknown>(row.result_json, null),
    isDemo: row.is_demo === 1,
  }));
}

export function deleteScenario(id: string, sessionId: string): boolean {
  const result = run("DELETE FROM scenarios WHERE id = ? AND session_id = ?", id, sessionId);
  return Number(result.changes) > 0;
}

export function deleteUserData(sessionId: string): void {
  transaction(() => {
    run("DELETE FROM prediction_legs WHERE prediction_id IN (SELECT id FROM predictions WHERE session_id = ?)", sessionId);
    run("DELETE FROM predictions WHERE session_id = ?", sessionId);
    run("DELETE FROM scenarios WHERE session_id = ?", sessionId);
    run("DELETE FROM preferences WHERE session_id = ?", sessionId);
  });
}

export function countRows(table: string): number {
  const allowed = new Set(["fixtures", "teams", "players", "competitions", "predictions", "scenarios"]);
  if (!allowed.has(table)) throw new Error("Tabella non consentita");
  const row = get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

export function getCache<T>(key: string): { payload: T; fetchedAt: string; ttlSeconds: number } | null {
  const row = get<{ payload: string; fetched_at: string; ttl_seconds: number }>(
    "SELECT payload, fetched_at, ttl_seconds FROM api_cache WHERE key = ?",
    key,
  );
  if (!row) return null;
  return {
    payload: safeJson<T>(row.payload, null as T),
    fetchedAt: row.fetched_at,
    ttlSeconds: row.ttl_seconds,
  };
}

export function setCache(key: string, payload: unknown, ttlSeconds: number, source: string): void {
  run(
    `INSERT INTO api_cache (key, payload, fetched_at, ttl_seconds, source)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at, ttl_seconds = excluded.ttl_seconds, source = excluded.source`,
    key,
    JSON.stringify(payload),
    new Date().toISOString(),
    ttlSeconds,
    source,
  );
}

export function getModelVersions(): Array<{ version: string; configJson: unknown; createdAt: string }> {
  return all<{ version: string; config_json: string; created_at: string }>(
    "SELECT version, config_json, created_at FROM model_versions ORDER BY created_at DESC",
  ).map((row) => ({
    version: row.version,
    configJson: safeJson<unknown>(row.config_json, null),
    createdAt: row.created_at,
  }));
}

export function getSourceMetadata(limit = 20): Array<{
  id: string;
  provider: string;
  entityType: string;
  entityId: string;
  fetchedAt: string;
  status: string;
  note: string | null;
}> {
  return all<{
    id: string;
    provider: string;
    entity_type: string;
    entity_id: string;
    fetched_at: string;
    status: string;
    note: string | null;
  }>("SELECT * FROM source_metadata ORDER BY fetched_at DESC LIMIT ?", limit).map((row) => ({
    id: row.id,
    provider: row.provider,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fetchedAt: row.fetched_at,
    status: row.status,
    note: row.note,
  }));
}

export function recordSourceMetadata(input: {
  provider: string;
  entityType: string;
  entityId: string;
  status: string;
  note?: string;
}): void {
  const id = `src-${randomUUID()}`;
  run(
    "INSERT INTO source_metadata (id, provider, entity_type, entity_id, fetched_at, status, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
    id,
    input.provider,
    input.entityType,
    input.entityId,
    new Date().toISOString(),
    input.status,
    input.note ?? null,
  );
}
