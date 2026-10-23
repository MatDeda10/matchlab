import type { MarketId } from "@/lib/config/constants";

/** Partita conclusa usata per stimare la forza delle squadre. */
export interface HistoricalMatch {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string;
  homeGoals: number;
  awayGoals: number;
  homeXg?: number | null;
  awayXg?: number | null;
}

export interface RatingsConfig {
  halfLifeDays: number;
  shrinkageMatches: number;
  rho: number;
  maxGoals: number;
  minMatches: number;
  iterations: number;
}

export interface TeamRating {
  teamId: string;
  /** Forza offensiva relativa alla media della competizione (1 = media). */
  attack: number;
  /** Debolezza difensiva relativa (1 = media, >1 concede più della media). */
  defence: number;
  matches: number;
  effectiveSample: number;
}

export interface RatingsModel {
  competitionId: string;
  asOf: string;
  leagueHomeGoals: number;
  leagueAwayGoals: number;
  homeAdvantage: number;
  teams: Record<string, TeamRating>;
  sampleMatches: number;
  config: RatingsConfig;
}

export interface ScoreMatrix {
  /** probabilities[homeGoals][awayGoals] */
  probabilities: number[][];
  maxGoals: number;
  lambdaHome: number;
  lambdaAway: number;
  rho: number;
  total: number;
}

export interface OneXTwo {
  home: number;
  draw: number;
  away: number;
}

export interface MarketProbability {
  key: string;
  marketId: MarketId;
  selectionId: string;
  label: string;
  probability: number;
}

export interface ProbabilityInterval {
  p10: number;
  p50: number;
  p90: number;
  spread: number;
  samples: number;
}

export type QualityBand = "HIGH" | "MEDIUM" | "LOW";

export interface DataQuality {
  score: number;
  band: QualityBand;
  missing: string[];
  reasons: string[];
}

export interface FixtureInput {
  id: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoff: string;
  status: string;
}

export interface FixturePrediction {
  fixtureId: string;
  modelVersion: string;
  generatedAt: string;
  lambdaHome: number;
  lambdaAway: number;
  matrix: ScoreMatrix;
  result: OneXTwo;
  markets: MarketProbability[];
  marketMap: Record<string, number>;
  quality: DataQuality;
  uncertainty: Record<string, ProbabilityInterval>;
  limitations: string[];
  coverage: {
    sampleMatches: number;
    homeMatches: number;
    awayMatches: number;
    minEffectiveSample: number;
    hasXg: boolean;
    hasLineups: boolean;
    hasAvailability: boolean;
  };
}

export interface SelectionCandidate {
  fixtureId: string;
  competitionId: string;
  kickoff: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  marketId: MarketId;
  selectionId: string;
  label: string;
  probability: number;
  quality: DataQuality;
  interval: ProbabilityInterval | null;
  modelVersion: string;
}

export type ProposalStatus = "OK" | "INSUFFICIENT";

export interface ProposalLeg {
  fixtureId: string;
  competitionId: string;
  kickoff: string;
  fixtureLabel: string;
  marketId: MarketId;
  marketLabel: string;
  selectionId: string;
  selectionLabel: string;
  probability: number;
  qualityScore: number;
  uncertainty: ProbabilityInterval | null;
  rationale: string;
  alternatives: Array<{
    selectionId: string;
    label: string;
    probability: number;
    deltaJoint: number;
  }>;
}

export interface ScenarioProposal {
  id: string;
  legs: ProposalLeg[];
  jointProbability: number;
  jointAssumption: string;
  averageQuality: number;
  worstQuality: number;
  uncertaintySpread: number;
  score: number;
  rationale: string;
}

export interface GenerationResult {
  status: ProposalStatus;
  proposals: ScenarioProposal[];
  message: string;
  excluded: Array<{ fixtureId: string; fixtureLabel: string; reason: string }>;
  candidatesEvaluated: number;
  generatedAt: string;
  modelVersions: string[];
  assumptions: string[];
}
