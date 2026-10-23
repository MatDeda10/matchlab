import path from "node:path";
import { createDatabase, databasePath, resetDatabase } from "../lib/db/index";
import { seedDemoData } from "../lib/demo/seed";

function status(): void {
  const db = createDatabase();
  const tables = ["competitions", "teams", "players", "fixtures", "lineups", "predictions", "scenarios"];
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
  case "status":
    status();
    break;
  default:
    console.error(`Comando sconosciuto: ${command}. Usa migrate | seed | reset | status.`);
    process.exit(1);
}
