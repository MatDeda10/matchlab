import { describe, expect, it } from "vitest";
import { computeRatings, expectedGoals } from "@/engine/ratings";
import type { HistoricalMatch } from "@/engine/types";

const AS_OF = "2026-06-01T00:00:00.000Z";

function match(
  id: string,
  home: string,
  away: string,
  homeGoals: number,
  awayGoals: number,
  daysAgo: number,
): HistoricalMatch {
  return {
    id,
    competitionId: "test",
    homeTeamId: home,
    awayTeamId: away,
    homeGoals,
    awayGoals,
    kickoff: new Date(new Date(AS_OF).getTime() - daysAgo * 86_400_000).toISOString(),
  };
}

function buildLeague(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  const teams = ["A", "B", "C", "D"];
  let index = 0;
  for (let round = 0; round < 12; round += 1) {
    for (let i = 0; i < teams.length; i += 1) {
      for (let j = i + 1; j < teams.length; j += 1) {
        const home = teams[i]!;
        const away = teams[j]!;
        index += 1;
        const strength: Record<string, number> = { A: 2.6, B: 1.7, C: 1.1, D: 0.5 };
        const homeGoals = round % 2 === 0 ? Math.round(strength[home]! * 1.2) : Math.round(strength[home]!);
        const awayGoals = round % 2 === 0 ? Math.round(strength[away]!) : Math.round(strength[away]! * 0.7);
        matches.push(match(`m${index}`, home, away, homeGoals, awayGoals, 300 - round * 10));
      }
    }
  }
  return matches;
}

function balancedLeague(): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  const teams = ["A", "B", "C", "D"];
  let index = 0;
  for (let round = 0; round < 10; round += 1) {
    for (const home of teams) {
      for (const away of teams) {
        if (home === away) continue;
        index += 1;
        // Ogni squadra segna 2 in casa e 1 in trasferta: il modello deve
        // riprodurre le medie della competizione, non amplificarle.
        matches.push(match(`b${index}`, home, away, 2, 1, 40 + round * 5));
      }
    }
  }
  return matches;
}

describe("Ratings", () => {
  it("ordina le squadre per forza offensiva", () => {
    const ratings = computeRatings(buildLeague(), "test", AS_OF);
    expect(ratings.teams.A!.attack).toBeGreaterThan(ratings.teams.B!.attack);
    expect(ratings.teams.B!.attack).toBeGreaterThan(ratings.teams.C!.attack);
    expect(ratings.teams.C!.attack).toBeGreaterThan(ratings.teams.D!.attack);
  });

  it("non usa partite successive alla data di riferimento", () => {
    const base = buildLeague();
    const before = computeRatings(base, "test", AS_OF);
    const future = [
      ...base,
      match("future", "D", "A", 8, 0, -5), // 5 giorni DOPO asOf
    ];
    const after = computeRatings(future, "test", AS_OF);
    expect(after.sampleMatches).toBe(before.sampleMatches);
    expect(after.teams.A!.attack).toBeCloseTo(before.teams.A!.attack, 10);
  });

  it("shrinka verso la media le squadre con pochi dati", () => {
    const sparse = computeRatings(
      [match("s1", "X", "Y", 7, 0, 10), match("s2", "Y", "Z", 0, 5, 12)],
      "test",
      AS_OF,
      { shrinkageMatches: 20 },
    );
    const attackX = sparse.teams.X!.attack;
    expect(attackX).toBeGreaterThan(1);
    expect(attackX).toBeLessThan(2.8);
    expect(sparse.teams.Z!.attack).toBeGreaterThan(1);
    // Con 2 partite la difesa di Y è quasi tutta shrinkata verso 1:
    // non deve esplodere, ma restare vicina alla media.
    expect(Math.abs(sparse.teams.Y!.defence - 1)).toBeLessThan(0.25);
  });

  it("produce lambda plausibili per una squadra media", () => {
    const ratings = computeRatings(balancedLeague(), "test", AS_OF, {
      shrinkageMatches: 2,
    });
    const { lambdaHome, lambdaAway } = expectedGoals(ratings, "A", "B");
    expect(lambdaHome).toBeGreaterThan(1.6);
    expect(lambdaHome).toBeLessThan(2.4);
    expect(lambdaAway).toBeGreaterThan(0.7);
    expect(lambdaAway).toBeLessThan(1.3);
    // Il vantaggio casa osservato (2 vs 1) deve essere preservato.
    expect(lambdaHome / lambdaAway).toBeGreaterThan(1.5);
    expect(lambdaHome / lambdaAway).toBeLessThan(2.5);
  });

  it("produce lambda positive e coerenti con il vantaggio casa", () => {
    const ratings = computeRatings(buildLeague(), "test", AS_OF);
    const { lambdaHome, lambdaAway } = expectedGoals(ratings, "A", "D");
    expect(lambdaHome).toBeGreaterThan(lambdaAway);
    expect(lambdaHome).toBeGreaterThan(0);
    expect(lambdaAway).toBeGreaterThan(0);
  });

  it("gestisce un campione vuoto senza lanciare eccezioni", () => {
    const ratings = computeRatings([], "test", AS_OF);
    expect(ratings.sampleMatches).toBe(0);
    expect(ratings.teams).toEqual({});
  });
});
