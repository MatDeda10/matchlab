import { createDatabase } from "../lib/db/index";
import { syncProviderData } from "../lib/services/sync";

async function main() {
  const daysBack = Number(process.argv[2] ?? 30);
  const daysForward = Number(process.argv[3] ?? 14);
  createDatabase();
  console.log(
    `Sincronizzazione provider (${Number.isFinite(daysBack) ? daysBack : 30} giorni indietro, ${
      Number.isFinite(daysForward) ? daysForward : 14
    } avanti)…`,
  );
  const result = await syncProviderData({ daysBack, daysForward });
  console.table({
    provider: result.provider,
    competizioni: result.competitions,
    squadre: result.teams,
    partite: result.fixtures,
    statistiche: result.statistics,
    quote: result.odds,
  });
  for (const warning of result.warnings) console.warn(`! ${warning}`);
  for (const item of result.unavailable) console.warn(`! ${item}`);
  console.log("Sincronizzazione completata.");
}

main().catch((error) => {
  console.error("Sincronizzazione fallita:", (error as Error).message);
  process.exitCode = 1;
});
