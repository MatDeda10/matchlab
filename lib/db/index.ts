import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedRealSnapshotIfEmpty } from "./snapshot";

export type SqlValue = string | number | bigint | null | Uint8Array;
export type DbRow = Record<string, unknown>;

const globalForDb = globalThis as unknown as {
  __matchlabDb?: DatabaseSync;
};

export function databasePath(): string {
  return process.env.DATABASE_PATH?.trim() || path.join(process.cwd(), "data", "matchlab.db");
}

function migrationsDir(): string {
  return path.join(process.cwd(), "db", "migrations");
}

type Migration = { id: string; sql: string };

function loadMigrations(): Migration[] {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) {
    throw new Error(
      `Directory migrazioni non trovata: ${dir}. Avvia i comandi dalla root del progetto.`,
    );
  }
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => ({
      id: file.replace(/\.sql$/, ""),
      sql: fs.readFileSync(path.join(dir, file), "utf8"),
    }));
}

export function applyMigrations(db: DatabaseSync): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const rows = db.prepare("SELECT id FROM _migrations").all() as Array<{ id: string }>;
  const applied = new Set(rows.map((row) => row.id));
  const newlyApplied: string[] = [];

  for (const migration of loadMigrations()) {
    if (applied.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO _migrations (id, applied_at) VALUES (?, ?)").run(
        migration.id,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
      newlyApplied.push(migration.id);
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migrazione ${migration.id} fallita: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
  return newlyApplied;
}

export function createDatabase(file = databasePath()): DatabaseSync {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  applyMigrations(db);
  return db;
}

/**
 * Connessione singleton. In sviluppo Next.js può ricaricare i moduli:
 * la cache su globalThis evita di aprire decine di handle SQLite.
 */
export function getDb(): DatabaseSync {
  if (!globalForDb.__matchlabDb) {
    const db = createDatabase();
    seedRealSnapshotIfEmpty(db);
    globalForDb.__matchlabDb = db;
  }
  return globalForDb.__matchlabDb;
}

function normalize(params: readonly SqlValue[]): SqlValue[] {
  return params.map((value) => (value === undefined ? null : value));
}

export function all<T>(sql: string, ...params: SqlValue[]): T[] {
  return getDb()
    .prepare(sql)
    .all(...normalize(params)) as unknown as T[];
}

export function get<T>(sql: string, ...params: SqlValue[]): T | undefined {
  return getDb()
    .prepare(sql)
    .get(...normalize(params)) as unknown as T | undefined;
}

export function run(sql: string, ...params: SqlValue[]) {
  return getDb()
    .prepare(sql)
    .run(...normalize(params));
}

export function exec(sql: string): void {
  getDb().exec(sql);
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function tableExists(name: string): boolean {
  const row = get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    name,
  );
  return Boolean(row);
}

export function resetDatabase(): void {
  const db = getDb();
  const tables = [
    "prediction_legs",
    "predictions",
    "scenarios",
    "preferences",
    "lineup_players",
    "lineups",
    "player_availability",
    "fixture_statistics",
    "odds_snapshots",
    "fixtures",
    "players",
    "teams",
    "competitions",
    "api_cache",
    "rate_limits",
    "source_metadata",
    "sync_runs",
  ];
  db.exec("PRAGMA foreign_keys = OFF;");
  for (const table of tables) {
    db.exec(`DELETE FROM ${table};`);
  }
  db.exec("PRAGMA foreign_keys = ON;");
}
