import { describe, expect, it } from "vitest";
import { summarizeMarket } from "@/lib/db/repositories";
import type { OddsQuoteDto } from "@/lib/db/types";

const MARKET = { id: "1X2", label: "Esito finale (1X2)", selections: ["HOME", "DRAW", "AWAY"] };

function quote(
  selectionId: string,
  odds: number,
  options: {
    bookmaker?: string;
    label?: string;
    closing?: boolean;
    marketId?: string;
  } = {},
): OddsQuoteDto {
  const bookmaker = options.bookmaker ?? "BEST";
  const marketId = options.marketId ?? "1X2";
  const closing = options.closing ?? true;
  return {
    id: `${marketId}-${selectionId}-${bookmaker}-${closing ? "c" : "p"}`,
    fixtureId: "fixture-1",
    provider: "football-data-uk",
    source: "football-data.co.uk",
    marketId,
    selectionId,
    bookmaker,
    bookmakerLabel: options.label ?? "Bet365",
    odds,
    isClosing: closing,
    fetchedAt: "2026-10-23T10:00:00.000Z",
  };
}

function oneXTwo(closing = true): OddsQuoteDto[] {
  return [
    quote("HOME", 2.1, { closing }),
    quote("DRAW", 3.6, { closing }),
    quote("AWAY", 4.2, { closing }),
    quote("HOME", 2.0, { bookmaker: "AVG", label: "Media di mercato", closing }),
    quote("DRAW", 3.5, { bookmaker: "AVG", label: "Media di mercato", closing }),
    quote("AWAY", 4.0, { bookmaker: "AVG", label: "Media di mercato", closing }),
  ];
}

describe("summarizeMarket", () => {
  it("calcola quote migliori, probabilità implicite e overround", () => {
    const summary = summarizeMarket("fixture-1", MARKET, oneXTwo(), {
      "1X2:HOME": 0.5,
      "1X2:DRAW": 0.28,
      "1X2:AWAY": 0.22,
    });
    expect(summary).not.toBeNull();
    expect(summary?.closing).toBe(true);
    expect(summary?.quoteCount).toBe(3);
    const home = summary?.selections.find((selection) => selection.selectionId === "HOME");
    expect(home?.label).toBe("Vittoria casa");
    expect(home?.best?.odds).toBe(2.1);
    expect(home?.best?.bookmakerLabel).toBe("Bet365");
    expect(home?.impliedProbability).toBeCloseTo(1 / 2.1, 6);
    expect(home?.consensusProbability).toBeCloseTo(0.5 / 1.035714, 5);
    expect(home?.delta).toBeCloseTo(0.5 - 0.5 / 1.035714, 5);
    expect(summary?.consensusOverround).toBeCloseTo(0.035714, 5);
    expect(summary?.bestOverround).toBeCloseTo(1 / 2.1 + 1 / 3.6 + 1 / 4.2 - 1, 6);
    expect(summary?.sources).toEqual(["football-data.co.uk"]);
  });

  it("preferisce le quote di chiusura a quelle pre-partita", () => {
    const quotes = [
      ...oneXTwo(false),
      quote("HOME", 2.25, { label: "Paddy Power" }),
      quote("DRAW", 3.7, { label: "Paddy Power" }),
      quote("AWAY", 4.3, { label: "Paddy Power" }),
    ];
    const summary = summarizeMarket("fixture-1", MARKET, quotes);
    expect(summary?.closing).toBe(true);
    expect(summary?.selections[0]?.best?.odds).toBe(2.25);
    expect(summary?.selections[0]?.best?.isClosing).toBe(true);
  });

  it("lascia null l'overround se manca una selezione", () => {
    const summary = summarizeMarket("fixture-1", MARKET, [quote("HOME", 2.1)]);
    expect(summary?.bestOverround).toBeNull();
    expect(summary?.consensusOverround).toBeNull();
    expect(summary?.selections.find((selection) => selection.selectionId === "DRAW")?.best).toBeNull();
  });

  it("non restituisce un mercato senza quote", () => {
    expect(summarizeMarket("fixture-1", MARKET, [])).toBeNull();
  });
});
