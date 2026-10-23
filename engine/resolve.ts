import type { MarketId } from "@/lib/config/constants";

export type ActualResult = "HOME" | "DRAW" | "AWAY";

export function actualResult(homeGoals: number, awayGoals: number): ActualResult {
  if (homeGoals > awayGoals) return "HOME";
  if (homeGoals < awayGoals) return "AWAY";
  return "DRAW";
}

/** Risolve una selezione su un risultato finale. null = mercato non risolvibile. */
export function resolveMarket(
  homeGoals: number,
  awayGoals: number,
  marketId: MarketId | string,
  selectionId: string,
): boolean | null {
  const total = homeGoals + awayGoals;
  switch (`${marketId}:${selectionId}`) {
    case "1X2:HOME":
      return homeGoals > awayGoals;
    case "1X2:DRAW":
      return homeGoals === awayGoals;
    case "1X2:AWAY":
      return awayGoals > homeGoals;
    case "DC:HOME_DRAW":
      return homeGoals >= awayGoals;
    case "DC:HOME_AWAY":
      return homeGoals !== awayGoals;
    case "DC:DRAW_AWAY":
      return awayGoals >= homeGoals;
    case "OU15:OVER":
      return total > 1.5;
    case "OU15:UNDER":
      return total < 1.5;
    case "OU25:OVER":
      return total > 2.5;
    case "OU25:UNDER":
      return total < 2.5;
    case "BTTS:YES":
      return homeGoals > 0 && awayGoals > 0;
    case "BTTS:NO":
      return homeGoals === 0 || awayGoals === 0;
    default:
      return null;
  }
}

export function marketsForResult(homeGoals: number, awayGoals: number): string[] {
  const won: string[] = [];
  for (const key of [
    "1X2:HOME", "1X2:DRAW", "1X2:AWAY",
    "DC:HOME_DRAW", "DC:HOME_AWAY", "DC:DRAW_AWAY",
    "OU15:OVER", "OU15:UNDER", "OU25:OVER", "OU25:UNDER",
    "BTTS:YES", "BTTS:NO",
  ]) {
    const [marketId, selectionId] = key.split(":");
    if (marketId && selectionId && resolveMarket(homeGoals, awayGoals, marketId, selectionId)) {
      won.push(key);
    }
  }
  return won;
}
