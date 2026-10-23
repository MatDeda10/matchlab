import type { ProbabilityInterval, TeamRating } from "./types";
import { buildScoreMatrix } from "./poisson";
import { buildMarketProbabilities } from "./markets";

/** PRNG deterministico: stessa partita → stessi intervalli. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  // Box-Muller con protezione dal log(0)
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sigmaFor(effectiveSample: number): number {
  const base = 0.22 / Math.sqrt(Math.max(effectiveSample, 1) / 10);
  return Math.min(0.26, Math.max(0.05, base));
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  const weight = index - lower;
  return lowerValue * (1 - weight) + upperValue * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface UncertaintyInput {
  fixtureId: string;
  leagueHomeGoals: number;
  leagueAwayGoals: number;
  home: TeamRating;
  away: TeamRating;
  rho: number;
  maxGoals: number;
  iterations?: number;
}

/**
 * Incertezza parametrica via Monte Carlo deterministico.
 *
 * Le forze attack/defence delle due squadre vengono perturbate in scala
 * logaritmica con sigma dipendente dal campione effettivo. Non è un
 * intervallo di confidenza frequentista: è una misura di sensibilità del
 * modello ai suoi input, dichiarata come tale.
 */
export function estimateUncertainty(input: UncertaintyInput): Record<string, ProbabilityInterval> {
  const iterations = input.iterations ?? 400;
  const rng = mulberry32(hashSeed(input.fixtureId));
  const sigHome = sigmaFor(input.home.effectiveSample);
  const sigAway = sigmaFor(input.away.effectiveSample);
  const samples: Record<string, number[]> = {};

  for (let i = 0; i < iterations; i += 1) {
    const attackHome = input.home.attack * Math.exp(gaussian(rng) * sigHome);
    const defenceHome = input.home.defence * Math.exp(gaussian(rng) * sigHome);
    const attackAway = input.away.attack * Math.exp(gaussian(rng) * sigAway);
    const defenceAway = input.away.defence * Math.exp(gaussian(rng) * sigAway);

    const lambdaHome = clamp(
      input.leagueHomeGoals * attackHome * defenceAway,
      0.15,
      4.5,
    );
    const lambdaAway = clamp(
      input.leagueAwayGoals * attackAway * defenceHome,
      0.15,
      4.5,
    );

    const matrix = buildScoreMatrix(lambdaHome, lambdaAway, input.rho, input.maxGoals);
    const map = buildMarketProbabilities(matrix);
    for (const [key, value] of Object.entries(map)) {
      (samples[key] ??= []).push(value);
    }
  }

  const intervals: Record<string, ProbabilityInterval> = {};
  for (const [key, values] of Object.entries(samples)) {
    values.sort((a, b) => a - b);
    const p10 = quantile(values, 0.1);
    const p50 = quantile(values, 0.5);
    const p90 = quantile(values, 0.9);
    intervals[key] = {
      p10,
      p50,
      p90,
      spread: p90 - p10,
      samples: values.length,
    };
  }
  return intervals;
}
