import type {
  AvailabilityDto,
  CompetitionDto,
  FixtureDto,
  FixtureStatisticsDto,
  LineupDto,
  TeamDto,
} from "@/lib/db/types";

export interface ProviderCapabilities {
  fixtures: boolean;
  results: boolean;
  standings: boolean;
  lineups: boolean;
  probableLineups: boolean;
  playerAvailability: boolean;
  matchStatistics: boolean;
  xg: boolean;
  players: boolean;
  historicalMatches: boolean;
}

export interface ProviderMeta {
  provider: string;
  fetchedAt: string;
  cached: boolean;
  note?: string;
}

export type ProviderResult<T> =
  | { status: "OK"; data: T; meta: ProviderMeta }
  | { status: "UNAVAILABLE"; reason: string; meta: ProviderMeta };

export interface FixtureQuery {
  from: string;
  to: string;
  competitionCodes?: string[];
}

export interface FootballDataProvider {
  readonly id: string;
  readonly label: string;
  readonly isDemo: boolean;
  readonly capabilities: ProviderCapabilities;
  readonly limitations: string[];
  readonly quotaNote: string;

  getCompetitions(): Promise<ProviderResult<CompetitionDto[]>>;
  getFixtures(query: FixtureQuery): Promise<ProviderResult<FixtureDto[]>>;
  getFixtureDetails(id: string): Promise<ProviderResult<FixtureDto>>;
  getHistoricalMatches(competitionId: string, from: string, to: string): Promise<ProviderResult<FixtureDto[]>>;
  getTeamStatistics(teamId: string): Promise<ProviderResult<never>>;
  getTeamPlayers(teamId: string): Promise<ProviderResult<never>>;
  getPlayerAvailability(fixtureId: string): Promise<ProviderResult<AvailabilityDto[]>>;
  getProbableLineups(fixtureId: string): Promise<ProviderResult<LineupDto[]>>;
  getOfficialLineups(fixtureId: string): Promise<ProviderResult<LineupDto[]>>;
  getFixtureStatistics(fixtureId: string): Promise<ProviderResult<FixtureStatisticsDto>>;
  getTeams(competitionId: string): Promise<ProviderResult<TeamDto[]>>;
}

export function unavailable<T>(provider: string, reason: string): ProviderResult<T> {
  return {
    status: "UNAVAILABLE",
    reason,
    meta: { provider, fetchedAt: new Date().toISOString(), cached: false },
  };
}

export function ok<T>(provider: string, data: T, note?: string, cached = false): ProviderResult<T> {
  return {
    status: "OK",
    data,
    meta: { provider, fetchedAt: new Date().toISOString(), cached, note },
  };
}
