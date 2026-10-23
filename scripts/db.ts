import path from "node:path";
import { createDatabase, databasePath, getDb, resetDatabase } from "../lib/db/index";
import { importRealSnapshot, readSnapshot, snapshotPath } from "../lib/db/snapshot";
import { seedDemoData } from "../lib/demo/seed";

// I comandi CLI non devono attivare il bootstrap automatico dello snapshot.
process.env.REAL_SNAPSHOT_DISABLE ??= "1";

function status(): void {
  const db = createDatabase();
  const tables = [
    "competitions",
    "teams",
    "players",
    "fixtures",
    "fixture_statistics",
    "odds_snapshots",
    "lineups",
    "predictions",
    "scenarios",
  ];
  console.log(`Database: ${path.resolve(databasePath())}`);
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    console.log(`  ${table.padEnd(14)} ${row.n}`);
  }
}

const command = process.argv[2] ?? "status";

switch (command) {
  case "migrate": {
    const db = createDatabase();
    const rows = db.prepare("SELECT id FROM _migrations ORDER BY id").all() as Array<{ id: string }>;
    console.log(`Migrazioni applicate: ${rows.map((row) => row.id).join(", ") || "nessuna"}`);
    console.log(`Database: ${path.resolve(databasePath())}`);
    break;
  }
  case "seed": {
    createDatabase();
    const result = seedDemoData({ reset: true });
    console.log("Dataset DEMO creato (dati sintetici, NON reali):");
    console.table(result);
    break;
  }
  case "reset": {
    createDatabase();
    resetDatabase();
    const result = seedDemoData({ reset: false });
    console.log("Database azzerato e dataset DEMO rigenerato:");
    console.table(result);
    break;
  }
  case "seed-real": {
    const snapshot = readSnapshot();
    if (!snapshot) {
      console.error(`Snapshot non trovato: ${path.resolve(snapshotPath())}`);
      console.error("Generalo con `npm run data:snapshot` oppure esegui `npm run sync`.");
      process.exit(1);
    }
    createDatabase();
    if (!process.argv.includes("--no-reset")) {
      resetDatabase();
      console.log("Database azzerato prima dell'import dello snapshot reale.");
    }
    const result = importRealSnapshot(getDb(), snapshot);
    console.log("Snapshot reale importato:");
    console.table(result);
    console.log("Le quote e le statistiche sono dati osservati dalla fonte, non stime.");
    break;
  }
  case "status":
    status();
    break;
  default:
    console.error(
      `Comando sconosciuto: ${command}. Usa migrate | seed | seed-real | reset | status.`,
    );
    process.exit(1);
}
