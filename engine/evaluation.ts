import type { OneXTwo } from "./types";

export interface LegRecord {
  key: string;
  marketId: string;
  competitionId: string;
  probability: number;
  won: boolean;
}

export interface PredictionRecord {
  id: string;
  createdAt: string;
  legs: LegRecord[];
  /** Probabilità 1X2 originali (snapshot) e risultato effettivo, se disponibili. */
  resultProbabilities?: OneXTwo;
  actualResult?: "HOME" | "DRAW" | "AWAY";
}

export interface CalibrationBin {
  label: string;
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number;
  observedRate: number;
}

export interface Metrics {
  count: number;
  brier: number;
  logLoss: number;
  calibrationError: number;
}

export interface BinMetrics extends Metrics {
  marketId: string;
}

export interface GroupMetrics extends Metrics {
  group: string;
}

export interface EvaluationResult {
  predictions: number;
  legs: number;
  brierBinary: number;
  logLossBinary: number;
  brier1x2: number | null;
  logLoss1x2: number | null;
  calibration: CalibrationBin[];
  calibrationError: number;
  byMarket: GroupMetrics[];
  byCompetition: GroupMetrics[];
  sampleWarning: boolean;
}

const EPSILON = 1e-6;

function clampProbability(p: number): number {
  return Math.min(1 - EPSILON, Math.max(EPSILON, p));
}

export function brierBinary(probability: number, actual: boolean): number {
  const outcome = actual ? 1 : 0;
  return (probability - outcome) ** 2;
}

export function logLossBinary(probability: number, actual: boolean): number {
  const p = clampProbability(probability);
  return actual ? -Math.log(p) : -Math.log(1 - p);
}

export function brierMulticlass(probabilities: OneXTwo, actual: "HOME" | "DRAW" | "AWAY"): number {
  const p = [probabilities.home, probabilities.draw, probabilities.away];
  const y = [actual === "HOME" ? 1 : 0, actual === "DRAW" ? 1 : 0, actual === "AWAY" ? 1 : 0];
  return p.reduce((sum, value, index) => sum + (value - (y[index] ?? 0)) ** 2, 0);
}

export function logLossMulticlass(probabilities: OneXTwo, actual: "HOME" | "DRAW" | "AWAY"): number {
  const p = actual === "HOME" ? probabilities.home : actual === "DRAW" ? probabilities.draw : probabilities.away;
  return -Math.log(clampProbability(p));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricsOf(pairs: Array<{ probability: number; won: boolean }>): Metrics {
  if (pairs.length === 0) {
    return { count: 0, brier: 0, logLoss: 0, calibrationError: 0 };
  }
  return {
    count: pairs.length,
    brier: mean(pairs.map((p) => brierBinary(p.probability, p.won))),
    logLoss: mean(pairs.map((p) => logLossBinary(p.probability, p.won))),
    calibrationError: 0,
  };
}

export function calibrationBins(
  pairs: Array<{ probability: number; won: boolean }>,
  binCount = 10,
): CalibrationBin[] {
  const bins: CalibrationBin[] = Array.from({ length: binCount }, (_, index) => ({
    label: `${index * 10}–${(index + 1) * 10}%`,
    lower: index / binCount,
    upper: (index + 1) / binCount,
    count: 0,
    meanPredicted: 0,
    observedRate: 0,
  }));

  const sums = bins.map(() => ({ p: 0, w: 0 }));
  for (const pair of pairs) {
    const raw = Math.min(1, Math.max(0, pair.probability));
    const index = Math.min(binCount - 1, Math.floor(raw * binCount));
    const bin = bins[index];
    const sum = sums[index];
    if (!bin || !sum) continue;
    bin.count += 1;
    sum.p += pair.probability;
    sum.w += pair.won ? 1 : 0;
  }

  bins.forEach((bin, index) => {
    const sum = sums[index];
    if (!sum || bin.count === 0) return;
    bin.meanPredicted = sum.p / bin.count;
    bin.observedRate = sum.w / bin.count;
  });

  return bins;
}

function calibrationError(bins: CalibrationBin[], total: number): number {
  if (total === 0) return 0;
  return bins.reduce((sum, bin) => {
    if (bin.count === 0) return sum;
    return sum + (bin.count / total) * Math.abs(bin.observedRate - bin.meanPredicted);
  }, 0);
}

/**
 * Metriche di calibrazione.
 *
 * Brier/log loss sono calcolati sulle singole leg selezionate (esito binario
 * "la selezione era corretta?"). Per le previsioni con snapshot 1X2 completo
 * viene calcolata anche la Brier multiclasse. Un campione piccolo è segnalato,
 * non nascosto.
 */
export function evaluatePredictions(
  predictions: PredictionRecord[],
  options: { sampleWarningThreshold?: number } = {},
): EvaluationResult {
  const allLegs = predictions.flatMap((prediction) => prediction.legs);
  const pairs = allLegs.map((leg) => ({ probability: leg.probability, won: leg.won }));
  const bins = calibrationBins(pairs);
  const base = metricsOf(pairs);

  const with1x2 = predictions.filter(
    (prediction) => prediction.resultProbabilities && prediction.actualResult,
  );
  const brier1x2 =
    with1x2.length > 0
      ? mean(
          with1x2.map((prediction) =>
            brierMulticlass(
              prediction.resultProbabilities as OneXTwo,
              prediction.actualResult as "HOME" | "DRAW" | "AWAY",
            ),
          ),
        )
      : null;
  const logLoss1x2 =
    with1x2.length > 0
      ? mean(
          with1x2.map((prediction) =>
            logLossMulticlass(
              prediction.resultProbabilities as OneXTwo,
              prediction.actualResult as "HOME" | "DRAW" | "AWAY",
            ),
          ),
        )
      : null;

  const byMarketMap = new Map<string, Array<{ probability: number; won: boolean }>>();
  const byCompetitionMap = new Map<string, Array<{ probability: number; won: boolean }>>();
  for (const leg of allLegs) {
    const market = byMarketMap.get(leg.marketId) ?? [];
    market.push({ probability: leg.probability, won: leg.won });
    byMarketMap.set(leg.marketId, market);

    const competition = byCompetitionMap.get(leg.competitionId) ?? [];
    competition.push({ probability: leg.probability, won: leg.won });
    byCompetitionMap.set(leg.competitionId, competition);
  }

  const byMarket: GroupMetrics[] = [...byMarketMap.entries()]
    .map(([group, groupPairs]) => ({ group, ...metricsOf(groupPairs) }))
    .sort((a, b) => b.count - a.count);
  const byCompetition: GroupMetrics[] = [...byCompetitionMap.entries()]
    .map(([group, groupPairs]) => ({ group, ...metricsOf(groupPairs) }))
    .sort((a, b) => b.count - a.count);

  return {
    predictions: predictions.length,
    legs: allLegs.length,
    brierBinary: base.brier,
    logLossBinary: base.logLoss,
    brier1x2,
    logLoss1x2,
    calibration: bins,
    calibrationError: calibrationError(bins, pairs.length),
    byMarket,
    byCompetition,
    sampleWarning: allLegs.length < (options.sampleWarningThreshold ?? 30),
  };
}

export function skillScore(modelBrier: number, baselineBrier: number): number {
  if (baselineBrier <= 0) return 0;
  return 1 - modelBrier / baselineBrier;
}
