import { describe, expect, it } from "vitest";
import { parseOdds } from "@/lib/api/football-data-uk";

const fetchedAt = "2026-10-23T10:00:00.000Z";

function quoteRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    B365H: "2.00",
    PPH: "2.10",
    SKBH: "1.95",
    B365D: "3.40",
    PPD: "3.50",
    SKBD: "3.30",
    B365A: "4.00",
    PPA: "4.20",
    SKBA: "3.90",
    B365CH: "1.95",
    PPCH: "2.12",
    SKBCH: "1.98",
    B365CD: "3.45",
    PPCD: "3.55",
    SKBCD: "3.35",
    B365CA: "4.05",
    PPCA: "4.25",
    SKBCA: "3.95",
    AvgH: "2.02",
    AvgD: "3.42",
    AvgA: "4.05",
    AvgCH: "2.05",
    AvgCD: "3.44",
    AvgCA: "4.08",
    "B365>2.5": "1.90",
    "PP>2.5": "1.95",
    "B365<2.5": "1.95",
    "PP<2.5": "1.90",
    "B365C>2.5": "1.88",
    "PPC>2.5": "1.92",
    "B365C<2.5": "1.97",
    "PPC<2.5": "1.93",
    "Avg>2.5": "1.92",
    "Avg<2.5": "1.92",
    "AvgC>2.5": "1.90",
    "AvgC<2.5": "1.94",
    ...overrides,
  };
}

describe("parseOdds", () => {
  it("salva una sintesi BEST + AVG per ogni selezione", () => {
    const quotes = parseOdds("fixture-1", quoteRow(), fetchedAt);
    expect(quotes).toHaveLength(10);
    expect(new Set(quotes.map((quote) => quote.marketId))).toEqual(
      new Set(["1X2", "OU25"]),
    );
    expect(new Set(quotes.map((quote) => quote.bookmaker))).toEqual(
      new Set(["BEST", "AVG"]),
    );
  });

  it("preferisce le quote di chiusura e attribuisce il bookmaker migliore", () => {
    const quotes = parseOdds("fixture-1", quoteRow(), fetchedAt);
    const homeBest = quotes.find(
      (quote) => quote.marketId === "1X2" && quote.selectionId === "HOME" && quote.bookmaker === "BEST",
    );
    expect(homeBest).toMatchObject({
      odds: 2.12,
      bookmakerLabel: "Paddy Power",
      isClosing: true,
    });
    expect(homeBest?.id).toContain("-BEST-c");
    const overBest = quotes.find(
      (quote) => quote.marketId === "OU25" && quote.selectionId === "OVER" && quote.bookmaker === "BEST",
    );
    expect(overBest).toMatchObject({
      odds: 1.92,
      bookmakerLabel: "Paddy Power",
      isClosing: true,
    });
  });

  it("usa la media della fonte e la quota richiesta in modalità pre-partita", () => {
    const quotes = parseOdds("fixture-1", quoteRow(), fetchedAt, "pre");
    const homeBest = quotes.find(
      (quote) => quote.marketId === "1X2" && quote.selectionId === "HOME" && quote.bookmaker === "BEST",
    );
    const homeAvg = quotes.find(
      (quote) => quote.marketId === "1X2" && quote.selectionId === "HOME" && quote.bookmaker === "AVG",
    );
    expect(homeBest).toMatchObject({ odds: 2.1, isClosing: false });
    expect(homeAvg).toMatchObject({ odds: 2.02, isClosing: false });
    expect(quotes.every((quote) => quote.isClosing === false)).toBe(true);
  });

  it("calcola la media dei bookmaker quando Avg manca", () => {
    const row = quoteRow({ AvgH: "", PPH: "2.20" });
    const quotes = parseOdds("fixture-1", row, fetchedAt, "pre");
    const homeAvg = quotes.find(
      (quote) => quote.marketId === "1X2" && quote.selectionId === "HOME" && quote.bookmaker === "AVG",
    );
    expect(homeAvg?.odds).toBeCloseTo((2 + 2.2 + 1.95) / 3, 6);
    expect(homeAvg?.bookmakerLabel).toBe("Media bookmaker");
  });

  it("non inventa quote e usa MAX solo come fallback dichiarato", () => {
    expect(parseOdds("fixture-1", {}, fetchedAt)).toEqual([]);
    const quotes = parseOdds(
      "fixture-1",
      { MaxH: "2.50", AvgH: "2.30" },
      fetchedAt,
      "pre",
    );
    expect(quotes).toHaveLength(2);
    expect(quotes.find((quote) => quote.bookmaker === "MAX")).toMatchObject({
      odds: 2.5,
      bookmakerLabel: "Massimo di mercato",
    });
  });

  it("scarta quote impossibili o fuori scala", () => {
    const quotes = parseOdds(
      "fixture-1",
      { B365H: "1.00", PPH: "1000", SKBH: "2.50", AvgH: "2.40" },
      fetchedAt,
      "pre",
    );
    expect(quotes.filter((quote) => quote.selectionId === "HOME")).toHaveLength(2);
    expect(quotes.find((quote) => quote.bookmaker === "BEST")?.odds).toBe(2.5);
  });
});
