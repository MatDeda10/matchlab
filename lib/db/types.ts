export type FixtureStatus =
  | "SCHEDULED"
  | "IN_PLAY"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED";

export interface CompetitionDto {
  id: string;
  name: string;
  country: string;
  code: string;
  tier: number;
  isDemo: boolean;
}

export interface TeamDto {
  id: string;
  competitionId: string;
  name: string;
  shortName: string;
  country: string;
  color: string | null;
}

export interface FixtureDto {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  season: string;
  round: string | null;
  homeTeamId: string;
  homeTeamName: string;
  homeTeamShort: string;
  homeColor: string | null;
  awayTeamId: string;
  awayTeamName: string;
  awayTeamShort: string;
  awayColor: string | null;
  kickoffUtc: string;
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
  venue: string | null;
  isDemo: boolean;
  updatedAt: string;
}

export interface FixtureStatisticsDto {
  fixtureId: string;
  homeXg: number | null;
  awayXg: number | null;
  homeShots: number | null;
  awayShots: number | null;
  homeShotsOnTarget: number | null;
  awayShotsOnTarget: number | null;
  homePossession: number | null;
  awayPossession: number | null;
  source: string;
  updatedAt: string;
}

export interface LineupPlayerDto {
  id: string;
  playerId: string | null;
  playerName: string;
  role: string;
  slot: number;
  isStarter: boolean;
  status: string;
  shirtNumber: number | null;
}

export interface LineupDto {
  fixtureId: string;
  teamId: string;
  kind: "OFFICIAL" | "PROBABLE" | "MODEL" | "UNAVAILABLE";
  formation: string | null;
  source: string;
  updatedAt: string;
  players: LineupPlayerDto[];
}

export interface AvailabilityDto {
  id: string;
  fixtureId: string;
  teamId: string;
  playerId: string | null;
  playerName: string;
  status: "AVAILABLE" | "INJURED" | "SUSPENDED" | "DOUBTFUL" | "RETURNING" | "UNKNOWN";
  reason: string | null;
  source: string;
  confidence: number | null;
  updatedAt: string;
}

export interface PredictionLegDto {
  id: string;
  fixtureId: string;
  competitionId: string;
  marketId: string;
  selectionId: string;
  probability: number;
  quality: number;
  actualWon: boolean | null;
}

export interface PredictionDto {
  id: string;
  sessionId: string;
  createdAt: string;
  kickoffMin: string | null;
  status: "OPEN" | "SETTLED" | "VOID";
  outcome: "WON" | "LOST" | "VOID" | null;
  modelVersion: string;
  dataQuality: number;
  isDemo: boolean;
  snapshot: unknown;
  settledAt: string | null;
  legs: PredictionLegDto[];
}

export interface ScenarioDto {
  id: string;
  sessionId: string;
  name: string;
  createdAt: string;
  modelVersion: string;
  config: unknown;
  result: unknown;
  isDemo: boolean;
}

export interface PreferencesDto {
  sessionId: string;
  theme: "dark" | "light" | "system";
  timezone: string;
  locale: string;
  favoriteCompetitions: string[];
  defaultProfile: string;
  interfacePrefs: Record<string, unknown>;
  updatedAt: string;
}

export interface StandingsRow {
  position: number;
  teamId: string;
  teamName: string;
  shortName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: Array<"W" | "D" | "L">;
}
