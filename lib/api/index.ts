import { FootballDataOrgProvider } from "./football-data";
import { DemoProvider } from "./demo";
import type { FootballDataProvider } from "./provider";

export const FOOTBALL_DATA_COMPETITIONS = (
  process.env.FOOTBALL_DATA_COMPETITIONS ?? "SA,PL,PD,BL1,FL1"
)
  .split(",")
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);

export interface DataSourceInfo {
  provider: FootballDataProvider;
  requestedProvider: string;
  isDemo: boolean;
  label: string;
  configured: boolean;
  warnings: string[];
  capabilities: FootballDataProvider["capabilities"];
  limitations: string[];
  quotaNote: string;
  footballDataKeyPresent: boolean;
}

let cached: DataSourceInfo | null = null;

export function getDataSource(): DataSourceInfo {
  if (cached) return cached;
  const requested = process.env.DATA_PROVIDER?.trim() || "demo";
  const key = process.env.FOOTBALL_DATA_API_KEY?.trim();
  const warnings: string[] = [];

  if (requested === "football-data") {
    if (!key) {
      warnings.push(
        "DATA_PROVIDER=football-data ma FOOTBALL_DATA_API_KEY non è impostata: l'app usa il dataset DEMO.",
      );
      cached = build(new DemoProvider(), requested, false, warnings, false);
      return cached;
    }
    cached = build(
      new FootballDataOrgProvider(key, FOOTBALL_DATA_COMPETITIONS),
      requested,
      true,
      warnings,
      true,
    );
    return cached;
  }

  if (requested !== "demo") {
    warnings.push(`DATA_PROVIDER="${requested}" non riconosciuto: uso il dataset DEMO.`);
  }
  cached = build(new DemoProvider(), requested, false, warnings, Boolean(key));
  return cached;
}

function build(
  provider: FootballDataProvider,
  requestedProvider: string,
  configured: boolean,
  warnings: string[],
  keyPresent: boolean,
): DataSourceInfo {
  return {
    provider,
    requestedProvider,
    isDemo: provider.isDemo,
    label: provider.label,
    configured,
    warnings,
    capabilities: provider.capabilities,
    limitations: provider.limitations,
    quotaNote: provider.quotaNote,
    footballDataKeyPresent: keyPresent,
  };
}

export function resetDataSourceCache(): void {
  cached = null;
}

export function getProvider(): FootballDataProvider {
  return getDataSource().provider;
}
