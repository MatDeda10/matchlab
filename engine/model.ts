import { MODEL } from "@/lib/config/constants";
import type {
  DataQuality,
  FixtureInput,
  FixturePrediction,
  MarketProbability,
  ProbabilityInterval,
  RatingsModel,
  TeamRating,
} from "./types";
import { expectedGoals } from "./ratings";
import { buildScoreMatrix, resultProbabilities } from "./poisson";
import { buildMarketProbabilities, marketProbabilitiesList, validateProbabilities } from "./markets";
import { scoreDataQuality } from "./quality";
import { estimateUncertainty } from "./uncertainty";

const DAY_MS = 86_400_000;

export interface PredictionContext {
  /** Giorni trascorsi dall'ultima partita osservata, per squadra. */
  daysSinceLastMatch?: { home: number | null; away: number | null };
  hasXg?: boolean;
  hasLineups?: boolean;
  hasAvailability?: boolean;
  hasMatchStats?: boolean;
  generatedAt?: string;
  withUncertainty?: boolean;
  rho?: number;
  maxGoals?: number;
  uncertaintyIterations?: number;
}

export class NonPreMatchError extends Error {
  constructor(status: string) {
    super(`La partita non è programmata (stato: ${status}). Le stime pre-partita non vengono mostrate.`);
    this.name = "NonPreMatchError";
  }
}

const DEFAULT_RATING: TeamRating = {
  teamId: "unknown",
  attack: 1,
  defence: 1,
  matches: 0,
  effectiveSample: 0,
};

/**
 * Predizione deterministica di una partita pre-partita.
 * Il modello non guarda risultati successivi alla data di generazione.
 */
export function predictFixture(
  fixture: FixtureInput,
  ratings: RatingsModel,
  context: PredictionContext = {},
): FixturePrediction {
  if (fixture.status !== "SCHEDULED") {
    throw new NonPreMatchError(fixture.status);
  }

  const home = ratings.teams[fixture.homeTeamId] ?? DEFAULT_RATING;
  const away = ratings.teams[fixture.awayTeamId] ?? DEFAULT_RATING;
  const { lambdaHome, lambdaAway } = expectedGoals(
    ratings,
    fixture.homeTeamId,
    fixture.awayTeamId,
  );
  const rho = context.rho ?? MODEL.rho;
  const maxGoals = context.maxGoals ?? MODEL.maxGoals;
  const matrix = buildScoreMatrix(lambdaHome, lambdaAway, rho, maxGoals);
  const marketMap = buildMarketProbabilities(matrix);
  const errors = validateProbabilities(marketMap);
  if (errors.length > 0) {
    throw new Error(`Probabilità incoerenti: ${errors.join("; ")}`);
  }

  const quality = scoreDataQuality({
    homeMatches: home.matches,
    awayMatches: away.matches,
    daysSinceHomeMatch: context.daysSinceLastMatch?.home ?? null,
    daysSinceAwayMatch: context.daysSinceLastMatch?.away ?? null,
    hasXg: context.hasXg ?? false,
    hasLineups: context.hasLineups ?? false,
    hasAvailability: context.hasAvailability ?? false,
    hasMatchStats: context.hasMatchStats ?? false,
  });

  const uncertainty: Record<string, ProbabilityInterval> = context.withUncertainty === false
    ? {}
    : estimateUncertainty({
        fixtureId: fixture.id,
        leagueHomeGoals: ratings.leagueHomeGoals,
        leagueAwayGoals: ratings.leagueAwayGoals,
        home,
        away,
        rho,
        maxGoals,
        iterations: context.uncertaintyIterations ?? MODEL.uncertaintyIterations,
      });

  const limitations: string[] = [
    "Stima pre-partita basata su risultati storici: non incorpora notizie dell'ultima ora.",
    "Le leg di una combinazione sono trattate come indipendenti solo se appartengono a partite diverse.",
    "Il modello non conosce quote e non calcola valore atteso o rendimento.",
  ];
  if (home.matches < MODEL.minMatchesForReliableRating || away.matches < MODEL.minMatchesForReliableRating) {
    limitations.push("Campione storico insufficiente per almeno una delle due squadre.");
  }
  if (!context.hasXg) limitations.push("xG non disponibile: la stima usa solo i gol.");
  if (!context.hasLineups) limitations.push("Formazioni non disponibili al momento della stima.");
  if (!context.hasAvailability) limitations.push("Stato indisponibili non disponibile.");

  return {
    fixtureId: fixture.id,
    modelVersion: MODEL.version,
    generatedAt: context.generatedAt ?? new Date().toISOString(),
    lambdaHome,
    lambdaAway,
    matrix,
    result: resultProbabilities(matrix),
    markets: marketProbabilitiesList(matrix),
    marketMap,
    quality,
    uncertainty,
    limitations,
    coverage: {
      sampleMatches: ratings.sampleMatches,
      homeMatches: home.matches,
      awayMatches: away.matches,
      minEffectiveSample: Math.min(home.effectiveSample, away.effectiveSample),
      hasXg: context.hasXg ?? false,
      hasLineups: context.hasLineups ?? false,
      hasAvailability: context.hasAvailability ?? false,
    },
  };
}

/** Evidenzia i mercati con probabilità più alta, senza implicare valore. */
export function strongestMarkets(
  prediction: FixturePrediction,
  limit = 4,
): MarketProbability[] {
  return [...prediction.markets]
    .filter((m) => m.probability > 0 && m.probability < 1)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, limit);
}

export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.round((now.getTime() - ts) / DAY_MS));
}

export function qualityRank(quality: DataQuality): number {
  return quality.score;
}
