import { createDatabase } from "../lib/db/index";
import { writeSnapshot, snapshotPath, type RealSnapshot } from "../lib/db/snapshot";
import type { FootballDataProvider, ProviderSyncBundle } from "../lib/api/provider";

async function main() {
  process.env.DATA_PROVIDER = process.env.DATA_PROVIDER?.trim() || "football-data-uk";
  process.env.REAL_SNAPSHOT_DISABLE = "1";
  if (process.argv.includes("--force")) process.env.FOOTBALL_DATA_UK_FORCE = "1";

  // Inizializza il database (serve anche alla cache HTTP del provider).
  createDatabase();

  const { getDataSource } = await import("../lib/api");
  const source = getDataSource();
  if (source.isDemo) {
    throw new Error("Imposta DATA_PROVIDER=football-data-uk per generare lo snapshot reale.");
  }
  const provider = source.provider as FootballDataProvider & {
    getSyncBundle: NonNullable<FootballDataProvider["getSyncBundle"]>;
  };
  if (!provider.getSyncBundle) {
    throw new Error("Il provider attivo non supporta lo snapshot bulk.");
  }

  console.log(`Scarico dati reali da ${source.label}…`);
  const result = await provider.getSyncBundle();
  if (result.status !== "OK") {
    throw new Error(result.reason);
  }
  const bundle: ProviderSyncBundle = result.data;
  const snapshot: RealSnapshot = {
    version: 1,
    provider: provider.id,
    generatedAt: new Date().toISOString(),
    sources: ["football-data.co.uk", "OpenFootball (CC0)"],
    competitions: bundle.competitions,
    teams: bundle.teams,
    fixtures: bundle.fixtures,
    statistics: bundle.statistics,
    odds: bundle.odds,
  };
  writeSnapshot(snapshot);
  console.log(`Snapshot scritto in ${snapshotPath()}`);
  console.table({
    competizioni: snapshot.competitions.length,
    squadre: snapshot.teams.length,
    partite: snapshot.fixtures.length,
    statistiche: snapshot.statistics.length,
    quote: snapshot.odds.length,
  });
  if (result.meta.note) console.warn(`! ${result.meta.note}`);
}

main().catch((error) => {
  console.error("Generazione snapshot fallita:", (error as Error).message);
  process.exitCode = 1;
});
