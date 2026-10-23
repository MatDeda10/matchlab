import { MARKETS, type MarketId } from "@/lib/config/constants";
import { probabilityAt, resultProbabilities } from "./poisson";
import type { MarketProbability, ScoreMatrix } from "./types";

export const MARKET_IDS = Object.keys(MARKETS) as MarketId[];

export function isMarketId(value: string): value is MarketId {
  return value in MARKETS;
}

export function marketLabel(marketId: MarketId): string {
  return MARKETS[marketId].label;
}

export function selectionLabel(marketId: MarketId, selectionId: string): string {
  const outcomes = MARKETS[marketId].outcomes as Record<string, string>;
  return outcomes[selectionId] ?? selectionId;
}

export function marketKey(marketId: MarketId, selectionId: string): string {
  return `${marketId}:${selectionId}`;
}

export function parseMarketKey(key: string): { marketId: MarketId; selectionId: string } | null {
  const [marketId, selectionId] = key.split(":");
  if (!marketId || !selectionId || !isMarketId(marketId)) return null;
  return { marketId, selectionId };
}

/** Selezioni valide per ogni mercato supportato. */
export const MARKET_SELECTIONS: Record<MarketId, string[]> = {
  "1X2": ["HOME", "DRAW", "AWAY"],
  DC: ["HOME_DRAW", "HOME_AWAY", "DRAW_AWAY"],
  OU25: ["OVER", "UNDER"],
  OU15: ["OVER", "UNDER"],
  BTTS: ["YES", "NO"],
};

export function overProbability(matrix: ScoreMatrix, line: number): number {
  let over = 0;
  for (let h = 0; h <= matrix.maxGoals; h += 1) {
    for (let a = 0; a <= matrix.maxGoals; a += 1) {
      if (h + a > line) over += probabilityAt(matrix, h, a);
    }
  }
  return over;
}

export function bttsProbability(matrix: ScoreMatrix): number {
  let yes = 0;
  for (let h = 1; h <= matrix.maxGoals; h += 1) {
    for (let a = 1; a <= matrix.maxGoals; a += 1) {
      yes += probabilityAt(matrix, h, a);
    }
  }
  return yes;
}

export function totalGoalsDistribution(matrix: ScoreMatrix): Array<{ goals: number; probability: number }> {
  const maxTotal = matrix.maxGoals * 2;
  const distribution = Array.from({ length: maxTotal + 1 }, (_, goals) => ({
    goals,
    probability: 0,
  }));
  for (let h = 0; h <= matrix.maxGoals; h += 1) {
    for (let a = 0; a <= matrix.maxGoals; a += 1) {
      const slot = distribution[h + a];
      if (slot) slot.probability += probabilityAt(matrix, h, a);
    }
  }
  return distribution;
}

export function buildMarketProbabilities(matrix: ScoreMatrix): Record<string, number> {
  const result = resultProbabilities(matrix);
  const over15 = overProbability(matrix, 1.5);
  const over25 = overProbability(matrix, 2.5);
  const btts = bttsProbability(matrix);

  return {
    "1X2:HOME": result.home,
    "1X2:DRAW": result.draw,
    "1X2:AWAY": result.away,
    "DC:HOME_DRAW": result.home + result.draw,
    "DC:HOME_AWAY": result.home + result.away,
    "DC:DRAW_AWAY": result.draw + result.away,
    "OU15:OVER": over15,
    "OU15:UNDER": 1 - over15,
    "OU25:OVER": over25,
    "OU25:UNDER": 1 - over25,
    "BTTS:YES": btts,
    "BTTS:NO": 1 - btts,
  };
}

export function marketProbabilitiesList(matrix: ScoreMatrix): MarketProbability[] {
  const map = buildMarketProbabilities(matrix);
  return Object.entries(map).map(([key, probability]) => {
    const [marketIdRaw, selectionIdRaw] = key.split(":");
    const marketId = marketIdRaw as MarketId;
    const selectionId = selectionIdRaw ?? "";
    return {
      key,
      marketId,
      selectionId,
      label: selectionLabel(marketId, selectionId),
      probability,
    };
  });
}

export function topCorrectScores(
  matrix: ScoreMatrix,
  limit = 6,
): Array<{ home: number; away: number; probability: number }> {
  const scores: Array<{ home: number; away: number; probability: number }> = [];
  for (let h = 0; h <= matrix.maxGoals; h += 1) {
    for (let a = 0; a <= matrix.maxGoals; a += 1) {
      scores.push({ home: h, away: a, probability: probabilityAt(matrix, h, a) });
    }
  }
  return scores.sort((x, y) => y.probability - x.probability).slice(0, limit);
}

/** Verifica di coerenza interna delle probabilità (usata nei test). */
export function validateProbabilities(map: Record<string, number>, tolerance = 1e-9): string[] {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (!Number.isFinite(value) || value < -tolerance || value > 1 + tolerance) {
      errors.push(`${key} fuori intervallo: ${value}`);
    }
  }
  const groups: Array<[string, string[]]> = [
    ["1X2", ["1X2:HOME", "1X2:DRAW", "1X2:AWAY"]],
    ["OU25", ["OU25:OVER", "OU25:UNDER"]],
    ["OU15", ["OU15:OVER", "OU15:UNDER"]],
    ["BTTS", ["BTTS:YES", "BTTS:NO"]],
  ];
  for (const [name, keys] of groups) {
    const sum = keys.reduce((acc, key) => acc + (map[key] ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-6) {
      errors.push(`${name} somma ${sum.toFixed(8)} invece di 1`);
    }
  }
  const dcSum =
    (map["DC:HOME_DRAW"] ?? 0) + (map["DC:HOME_AWAY"] ?? 0) + (map["DC:DRAW_AWAY"] ?? 0);
  if (Math.abs(dcSum - 2) > 1e-6) {
    errors.push(`DC somma ${dcSum.toFixed(8)} invece di 2`);
  }
  return errors;
}
