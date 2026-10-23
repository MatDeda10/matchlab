import { describe, expect, it } from "vitest";
import { generateProposals, jointProbability } from "@/engine/combination";
import type { SelectionCandidate } from "@/engine/types";
import { scoreDataQuality } from "@/engine/quality";

function quality(score = 80) {
  return {
    score,
    band: score >= 70 ? ("HIGH" as const) : ("MEDIUM" as const),
    missing: [],
    reasons: [],
  };
}

function candidatesFor(fixtures: number, probability = 0.6): SelectionCandidate[] {
  const list: SelectionCandidate[] = [];
  for (let i = 1; i <= fixtures; i += 1) {
    for (const [marketId, selectionId, p] of [
      ["1X2", "HOME", probability],
      ["1X2", "DRAW", 0.25],
      ["1X2", "AWAY", 0.15],
    ] as const) {
      list.push({
        fixtureId: `f${i}`,
        competitionId: i % 2 === 0 ? "comp-a" : "comp-b",
        kickoff: new Date(Date.now() + i * 86_400_000).toISOString(),
        homeTeamId: `h${i}`,
        awayTeamId: `a${i}`,
        homeTeamName: `Casa ${i}`,
        awayTeamName: `Ospite ${i}`,
        marketId,
        selectionId,
        label: selectionId,
        probability: p,
        quality: quality(),
        interval: { p10: p - 0.05, p50: p, p90: p + 0.05, spread: 0.1, samples: 400 },
        modelVersion: "test",
        market: null,
      });
    }
  }
  return list;
}

describe("Generatore di combinazioni", () => {
  it("seleziona esattamente N partite distinte", () => {
    const result = generateProposals(candidatesFor(8), {
      events: 3,
      profile: "balanced",
      markets: ["1X2"],
    });
    expect(result.status).toBe("OK");
    const best = result.proposals[0]!;
    expect(best.legs).toHaveLength(3);
    expect(new Set(best.legs.map((leg) => leg.fixtureId)).size).toBe(3);
  });

  it("calcola la probabilità congiunta come prodotto", () => {
    const result = generateProposals(candidatesFor(8, 0.5), {
      events: 2,
      profile: "balanced",
      markets: ["1X2"],
    });
    const best = result.proposals[0]!;
    const product = jointProbability(best.legs.map((leg) => leg.probability));
    expect(best.jointProbability).toBeCloseTo(product, 12);
    expect(best.jointProbability).toBeLessThanOrEqual(0.25 + 1e-12);
  });

  it("non crea mai due leg sulla stessa partita", () => {
    const result = generateProposals(candidatesFor(8), {
      events: 4,
      profile: "aggressive",
      markets: ["1X2"],
    });
    for (const proposal of result.proposals) {
      const fixtures = proposal.legs.map((leg) => leg.fixtureId);
      expect(new Set(fixtures).size).toBe(fixtures.length);
    }
  });

  it("dichiara insufficienza quando mancano eventi", () => {
    const result = generateProposals(candidatesFor(2), {
      events: 4,
      profile: "balanced",
      markets: ["1X2"],
    });
    expect(result.status).toBe("INSUFFICIENT");
    expect(result.proposals).toHaveLength(0);
    expect(result.message).toContain("abbastanza partite");
  });

  it("il profilo prudente applica soglie più alte", () => {
    const candidates = candidatesFor(10, 0.5);
    const prudent = generateProposals(candidates, {
      events: 2,
      profile: "prudent",
      markets: ["1X2"],
    });
    expect(prudent.status).toBe("INSUFFICIENT");
    const aggressive = generateProposals(candidates, {
      events: 2,
      profile: "aggressive",
      markets: ["1X2"],
    });
    expect(aggressive.status).toBe("OK");
  });

  it("rispetta il limite per competizione quando possibile", () => {
    const result = generateProposals(candidatesFor(8), {
      events: 2,
      profile: "balanced",
      markets: ["1X2"],
      maxPerCompetition: 1,
    });
    const best = result.proposals[0]!;
    const counts = new Map<string, number>();
    for (const leg of best.legs) {
      counts.set(leg.competitionId, (counts.get(leg.competitionId) ?? 0) + 1);
    }
    for (const count of counts.values()) expect(count).toBeLessThanOrEqual(1);
  });

  it("espone alternative reali per ogni leg", () => {
    const result = generateProposals(candidatesFor(8), {
      events: 2,
      profile: "balanced",
      markets: ["1X2"],
    });
    for (const leg of result.proposals[0]!.legs) {
      expect(leg.alternatives.length).toBeGreaterThan(0);
      expect(leg.alternatives[0]!.probability).toBeGreaterThan(0);
    }
  });
});

describe("Qualità del dato", () => {
  it("penalizza campioni piccoli e dati mancanti", () => {
    const poor = scoreDataQuality({
      homeMatches: 2,
      awayMatches: 3,
      daysSinceHomeMatch: 80,
      daysSinceAwayMatch: 75,
      hasXg: false,
      hasLineups: false,
      hasAvailability: false,
      hasMatchStats: false,
    });
    expect(poor.band).toBe("LOW");
    expect(poor.score).toBeLessThan(45);
    expect(poor.missing.length).toBeGreaterThanOrEqual(3);
  });

  it("premia un campione ampio e dati completi", () => {
    const good = scoreDataQuality({
      homeMatches: 25,
      awayMatches: 22,
      daysSinceHomeMatch: 4,
      daysSinceAwayMatch: 6,
      hasXg: true,
      hasLineups: true,
      hasAvailability: true,
      hasMatchStats: true,
    });
    expect(good.band).toBe("HIGH");
    expect(good.missing).toHaveLength(0);
  });
});
