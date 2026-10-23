import { describe, expect, it } from "vitest";
import {
  brierBinary,
  brierMulticlass,
  calibrationBins,
  evaluatePredictions,
  logLossBinary,
  logLossMulticlass,
} from "@/engine/evaluation";
import { estimateUncertainty } from "@/engine/uncertainty";
import { buildScoreMatrix } from "@/engine/poisson";

describe("Metriche", () => {
  it("Brier binaria è 0 con previsione perfetta e 1 con previsione opposta", () => {
    expect(brierBinary(1, true)).toBe(0);
    expect(brierBinary(0, false)).toBe(0);
    expect(brierBinary(0, true)).toBe(1);
  });

  it("log loss premia le previsioni calibrate", () => {
    expect(logLossBinary(1, true)).toBeCloseTo(0, 5);
    expect(logLossBinary(0.5, true)).toBeCloseTo(Math.log(2), 10);
    expect(logLossBinary(0.99, false)).toBeGreaterThan(4);
  });

  it("Brier multiclasse e log loss 1X2", () => {
    const probs = { home: 0.5, draw: 0.3, away: 0.2 };
    expect(brierMulticlass(probs, "HOME")).toBeCloseTo(0.38, 10);
    expect(logLossMulticlass(probs, "HOME")).toBeCloseTo(Math.log(2), 10);
  });

  it("costruisce bin di calibrazione con conteggi corretti", () => {
    const bins = calibrationBins(
      [
        { probability: 0.05, won: false },
        { probability: 0.15, won: false },
        { probability: 0.15, won: true },
        { probability: 0.95, won: true },
      ],
      10,
    );
    expect(bins[0]!.count).toBe(1);
    expect(bins[1]!.count).toBe(2);
    expect(bins[9]!.count).toBe(1);
    expect(bins[1]!.observedRate).toBeCloseTo(0.5, 10);
  });

  it("aggrega per mercato e competizione ed esclude i dati incompleti dal 1X2", () => {
    const result = evaluatePredictions([
      {
        id: "p1",
        createdAt: "2026-01-01T00:00:00.000Z",
        legs: [
          { key: "1X2:HOME", marketId: "1X2", competitionId: "serie-a", probability: 0.6, won: true },
          { key: "OU25:OVER", marketId: "OU25", competitionId: "serie-a", probability: 0.55, won: false },
        ],
        resultProbabilities: { home: 0.6, draw: 0.25, away: 0.15 },
        actualResult: "HOME",
      },
      {
        id: "p2",
        createdAt: "2026-01-02T00:00:00.000Z",
        legs: [
          { key: "BTTS:YES", marketId: "BTTS", competitionId: "premier", probability: 0.5, won: true },
        ],
      },
    ]);
    expect(result.predictions).toBe(2);
    expect(result.legs).toBe(3);
    expect(result.brier1x2).toBeCloseTo(0.245, 10);
    expect(result.byMarket).toHaveLength(3);
    expect(result.byCompetition).toHaveLength(2);
    expect(result.sampleWarning).toBe(true);
  });
});

describe("Incertezza", () => {
  const team = (id: string, attack: number, defence: number) => ({
    teamId: id,
    attack,
    defence,
    matches: 30,
    effectiveSample: 20,
  });

  it("è deterministica per la stessa partita", () => {
    const input = {
      fixtureId: "fixture-1",
      leagueHomeGoals: 1.5,
      leagueAwayGoals: 1.1,
      home: team("h", 1.3, 0.9),
      away: team("a", 1.0, 1.1),
      rho: -0.06,
      maxGoals: 10,
    };
    const first = estimateUncertainty(input);
    const second = estimateUncertainty(input);
    expect(first["1X2:HOME"]).toEqual(second["1X2:HOME"]);
  });

  it("produce intervalli ordinati attorno alla stima centrale", () => {
    const result = estimateUncertainty({
      fixtureId: "fixture-2",
      leagueHomeGoals: 1.5,
      leagueAwayGoals: 1.1,
      home: team("h", 1.3, 0.9),
      away: team("a", 1.0, 1.1),
      rho: -0.06,
      maxGoals: 10,
      iterations: 200,
    });
    const home = result["1X2:HOME"]!;
    expect(home.p10).toBeLessThanOrEqual(home.p50);
    expect(home.p50).toBeLessThanOrEqual(home.p90);
    expect(home.spread).toBeGreaterThan(0);
  });

  it("la matrice di riferimento è normalizzata", () => {
    const matrix = buildScoreMatrix(1.4, 1.2);
    const total = matrix.probabilities.flat().reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 9);
  });
});
