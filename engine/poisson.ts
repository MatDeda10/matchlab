import type { OneXTwo, ScoreMatrix } from "./types";

const FACTORIAL_CACHE: number[] = [1];

function factorial(n: number): number {
  for (let i = FACTORIAL_CACHE.length; i <= n; i += 1) {
    FACTORIAL_CACHE[i] = (FACTORIAL_CACHE[i - 1] ?? 1) * i;
  }
  return FACTORIAL_CACHE[n] ?? 1;
}

/** P(X = k) per una Poisson con media lambda. */
export function poissonPmf(k: number, lambda: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

/**
 * Correzione Dixon-Coles per i punteggi bassi.
 * rho < 0 aumenta la probabilità di 0-0 e 1-1 (pareggi correlati).
 */
export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 + lambdaHome * lambdaAway * rho * -1;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

/**
 * Matrice dei punteggi esatti, troncata a maxGoals e normalizzata.
 * Le probabilità sommano sempre a 1 (tolleranza floating point).
 */
export function buildScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho = -0.06,
  maxGoals = 10,
): ScoreMatrix {
  const probabilities: number[][] = [];
  let total = 0;

  for (let h = 0; h <= maxGoals; h += 1) {
    const row: number[] = [];
    for (let a = 0; a <= maxGoals; a += 1) {
      const base = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway);
      const tau = Math.max(0, dixonColesTau(h, a, lambdaHome, lambdaAway, rho));
      const value = base * tau;
      row.push(value);
      total += value;
    }
    probabilities.push(row);
  }

  if (!Number.isFinite(total) || total <= 0) {
    // Fallback estremamente conservativo: 0-0 con probabilità 1.
    const fallback = Array.from({ length: maxGoals + 1 }, (_, h) =>
      Array.from({ length: maxGoals + 1 }, (_, a) => (h === 0 && a === 0 ? 1 : 0)),
    );
    return {
      probabilities: fallback,
      maxGoals,
      lambdaHome,
      lambdaAway,
      rho,
      total: 1,
    };
  }

  for (let h = 0; h <= maxGoals; h += 1) {
    for (let a = 0; a <= maxGoals; a += 1) {
      const row = probabilities[h];
      if (row) row[a] = (row[a] ?? 0) / total;
    }
  }

  return {
    probabilities,
    maxGoals,
    lambdaHome,
    lambdaAway,
    rho,
    total: 1,
  };
}

/** Riga della matrice; evita undefined con noUncheckedIndexedAccess. */
export function probabilityAt(matrix: ScoreMatrix, home: number, away: number): number {
  return matrix.probabilities[home]?.[away] ?? 0;
}

export function resultProbabilities(matrix: ScoreMatrix): OneXTwo {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let h = 0; h <= matrix.maxGoals; h += 1) {
    for (let a = 0; a <= matrix.maxGoals; a += 1) {
      const p = probabilityAt(matrix, h, a);
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
    }
  }
  return { home, draw, away };
}
