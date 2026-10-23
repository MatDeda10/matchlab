import { describe, expect, it } from "vitest";
import {
  buildScoreMatrix,
  dixonColesTau,
  poissonPmf,
  probabilityAt,
  resultProbabilities,
} from "@/engine/poisson";
import {
  buildMarketProbabilities,
  overProbability,
  topCorrectScores,
  validateProbabilities,
} from "@/engine/markets";

describe("Poisson", () => {
  it("calcola la pmf e somma a 1 su un intervallo ampio", () => {
    expect(poissonPmf(0, 1.5)).toBeCloseTo(Math.exp(-1.5), 10);
    let sum = 0;
    for (let k = 0; k <= 40; k += 1) sum += poissonPmf(k, 2.1);
    expect(sum).toBeCloseTo(1, 8);
  });

  it("normalizza la matrice dei punteggi", () => {
    const matrix = buildScoreMatrix(1.8, 1.1, -0.06, 10);
    let sum = 0;
    for (let h = 0; h <= 10; h += 1) {
      for (let a = 0; a <= 10; a += 1) sum += probabilityAt(matrix, h, a);
    }
    expect(sum).toBeCloseTo(1, 9);
  });

  it("produce 1X2 coerente", () => {
    const matrix = buildScoreMatrix(1.7, 1.2);
    const result = resultProbabilities(matrix);
    expect(result.home + result.draw + result.away).toBeCloseTo(1, 9);
    expect(result.home).toBeGreaterThan(result.away);
  });

  it("la correzione Dixon-Coles aumenta i pareggi a basso punteggio", () => {
    expect(dixonColesTau(0, 0, 1.4, 1.1, -0.06)).toBeGreaterThan(1);
    expect(dixonColesTau(1, 1, 1.4, 1.1, -0.06)).toBeGreaterThan(1);
    expect(dixonColesTau(0, 1, 1.4, 1.1, -0.06)).toBeLessThan(1);
  });
});

describe("Mercati", () => {
  const matrix = buildScoreMatrix(1.6, 1.25);
  const map = buildMarketProbabilities(matrix);

  it("rispetta tutte le identità probabilistiche", () => {
    expect(validateProbabilities(map)).toEqual([]);
  });

  it("calcola Over/Under e Gol/No Gol coerenti", () => {
    expect(overProbability(matrix, 2.5)).toBeCloseTo(map["OU25:OVER"] ?? 0, 10);
    expect((map["OU25:OVER"] ?? 0) + (map["OU25:UNDER"] ?? 0)).toBeCloseTo(1, 10);
    expect((map["BTTS:YES"] ?? 0) + (map["BTTS:NO"] ?? 0)).toBeCloseTo(1, 10);
  });

  it("ordina i risultati esatti per probabilità", () => {
    const scores = topCorrectScores(matrix, 5);
    expect(scores).toHaveLength(5);
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i - 1]!.probability).toBeGreaterThanOrEqual(scores[i]!.probability);
    }
  });

  it("over 1.5 è sempre maggiore di over 2.5", () => {
    expect(overProbability(matrix, 1.5)).toBeGreaterThan(overProbability(matrix, 2.5));
  });
});
