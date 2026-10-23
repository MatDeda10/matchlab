import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import type { DatabaseSync } from "node:sqlite";
import type {
  CompetitionDto,
  FixtureDto,
  FixtureStatisticsDto,
  OddsQuoteDto,
  TeamDto,
} from "./types";

export interface RealSnapshot {
  version: 1;
  provider: string;
  generatedAt: string;
  sources: string[];
  competitions: CompetitionDto[];
  teams: TeamDto[];
  fixtures: FixtureDto[];
  statistics: FixtureStatisticsDto[];
  odds: OddsQuoteDto[];
}

export interface SnapshotImportResult {
  competitions: number;
  teams: number;
  fixtures: number;
  statistics: number;
  odds: number;
  generatedAt: string;
}

const DEFAULT_SNAPSHOT_BASE = path.join(process.cwd(), "data", "real", "snapshot");

export function snapshotPath(): string {
  const configured = process.env.REAL_SNAPSHOT_PATH?.trim();
  if (configured) return configured;
  // Il file base64 compresso è quello pubblicato su GitHub: resta sotto il
  // limite dell'API Contents e non richiede Git LFS. Gli altri formati sono
  // accettati per uso locale o per chi preferisce il JSON leggibile.
  for (const candidate of [
    `${DEFAULT_SNAPSHOT_BASE}.json.gz.b64`,
    `${DEFAULT_SNAPSHOT_BASE}.json.gz`,
    `${DEFAULT_SNAPSHOT_BASE}.json`,
  ]) {
    if (fs.existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
  }
  return `${DEFAULT_SNAPSHOT_BASE}.json.gz.b64`;
}

function readSnapshotText(file: string): string {
  if (file.endsWith(".gz.b64")) {
    const encoded = fs
      .readFileSync(/* turbopackIgnore: true */ file, "utf8")
      .replace(/\s+/g, "");
    return gunzipSync(Buffer.from(encoded, "base64")).toString("utf8");
  }
  if (file.endsWith(".gz")) {
    return gunzipSync(fs.readFileSync(/* turbopackIgnore: true */ file)).toString("utf8");
  }
  return fs.readFileSync(/* turbopackIgnore: true */ file, "utf8");
}

export function readSnapshot(file = snapshotPath()): RealSnapshot | null {
  if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;
  const parsed = JSON.parse(readSnapshotText(file)) as Partial<RealSnapshot>;
  if (
    parsed.version !== 1 ||
    !Array.isArray(parsed.competitions) ||
    !Array.isArray(parsed.teams) ||
    !Array.isArray(parsed.fixtures) ||
    !Array.isArray(parsed.statistics) ||
    !Array.isArray(parsed.odds)
  ) {
    throw new Error(`Snapshot non valido: ${file}`);
  }
  return {
    version: 1,
    provider: String(parsed.provider ?? "football-data-uk"),
    generatedAt: String(parsed.generatedAt ?? new Date().toISOString()),
    sources: Array.isArray(parsed.sources) ? parsed.sources.map(String) : [],
    competitions: parsed.competitions as CompetitionDto[],
    teams: parsed.teams as TeamDto[],
    fixtures: parsed.fixtures as FixtureDto[],
    statistics: parsed.statistics as FixtureStatisticsDto[],
    odds: parsed.odds as OddsQuoteDto[],
  };
}

export function writeSnapshot(snapshot: RealSnapshot, file = snapshotPath()): void {
  fs.mkdirSync(/* turbopackIgnore: true */ path.dirname(file), { recursive: true });
  const json = JSON.stringify(snapshot);
  if (file.endsWith(".gz.b64")) {
    const compressed = gzipSync(Buffer.from(json, "utf8"), { level: 9 });
    fs.writeFileSync(/* turbopackIgnore: true */ file, compressed.toString("base64"), "utf8");
    return;
  }
  if (file.endsWith(".gz")) {
    fs.writeFileSync(/* turbopackIgnore: true */ file, gzipSync(Buffer.from(json, "utf8"), { level: 9 }));
    return;
  }
  fs.writeFileSync(/* turbopackIgnore: true */ file, json, "utf8");
}

/**
 * Importa uno snapshot già validato. È volutamente sincrono e usa solo SQL:
 * viene chiamato durante l'apertura del database, prima che i repository siano
 * disponibili, per evitare dipendenze circolari.
 */
export function importRealSnapshot(
  db: DatabaseSync,
  snapshot: RealSnapshot,
): SnapshotImportResult {
  const now = new Date().toISOString();
  const competition = db.prepare(
    `INSERT INTO competitions (id, name, country, code, tier, provider, provider_ref, logo_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, country = excluded.country,
       code = excluded.code, tier = excluded.tier, provider = excluded.provider,
       updated_at = excluded.updated_at`,
  );
  const team = db.prepare(
    `INSERT INTO teams (id, competition_id, name, short_name, country, provider, provider_ref, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, short_name = excluded.short_name,
       competition_id = excluded.competition_id, country = excluded.country,
       color = excluded.color, updated_at = excluded.updated_at`,
  );
  const fixture = db.prepare(
    `INSERT INTO fixtures (id, competition_id, season, round, home_team_id, away_team_id, kickoff_utc, status,
       home_goals, away_goals, venue, provider, provider_ref, is_demo, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, home_goals = excluded.home_goals, away_goals = excluded.away_goals,
       kickoff_utc = excluded.kickoff_utc, round = excluded.round, venue = excluded.venue,
       updated_at = excluded.updated_at`,
  );
  const statistics = db.prepare(
    `INSERT INTO fixture_statistics
       (fixture_id, home_xg, away_xg, home_shots, away_shots, home_shots_on_target,
        away_shots_on_target, home_possession, away_possession, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fixture_id) DO UPDATE SET
       home_xg = excluded.home_xg, away_xg = excluded.away_xg,
       home_shots = excluded.home_shots, away_shots = excluded.away_shots,
       home_shots_on_target = excluded.home_shots_on_target,
       away_shots_on_target = excluded.away_shots_on_target,
       home_possession = excluded.home_possession, away_possession = excluded.away_possession,
       source = excluded.source, updated_at = excluded.updated_at`,
  );
  const odds = db.prepare(
    `INSERT INTO odds_snapshots
       (id, fixture_id, provider, source, market_id, selection_id, bookmaker, bookmaker_label,
        odds_decimal, is_closing, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(fixture_id, market_id, selection_id, bookmaker, is_closing, source)
     DO UPDATE SET
       id = excluded.id,
       provider = excluded.provider,
       bookmaker_label = excluded.bookmaker_label,
       odds_decimal = excluded.odds_decimal,
       fetched_at = excluded.fetched_at`,
  );

  db.exec("BEGIN");
  try {
    for (const item of snapshot.competitions) {
      competition.run(
        item.id,
        item.name,
        item.country,
        item.code,
        item.tier,
        snapshot.provider,
        item.code,
        now,
        now,
      );
    }
    for (const item of snapshot.teams) {
      team.run(
        item.id,
        item.competitionId,
        item.name,
        item.shortName,
        item.country,
        snapshot.provider,
        item.id,
        item.color ?? null,
        now,
        now,
      );
    }
    for (const item of snapshot.fixtures) {
      fixture.run(
        item.id,
        item.competitionId,
        item.season,
        item.round,
        item.homeTeamId,
        item.awayTeamId,
        item.kickoffUtc,
        item.status,
        item.homeGoals,
        item.awayGoals,
        item.venue,
        snapshot.provider,
        item.id,
        now,
      );
    }
    for (const item of snapshot.statistics) {
      statistics.run(
        item.fixtureId,
        item.homeXg,
        item.awayXg,
        item.homeShots,
        item.awayShots,
        item.homeShotsOnTarget,
        item.awayShotsOnTarget,
        item.homePossession,
        item.awayPossession,
        item.source,
        item.updatedAt,
      );
    }
    for (const item of snapshot.odds) {
      odds.run(
        item.id,
        item.fixtureId,
        item.provider,
        item.source,
        item.marketId,
        item.selectionId,
        item.bookmaker,
        item.bookmakerLabel,
        item.odds,
        item.isClosing ? 1 : 0,
        item.fetchedAt,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  db.prepare(
    `INSERT INTO source_metadata (id, provider, entity_type, entity_id, fetched_at, status, note)
     VALUES (?, ?, 'snapshot', '*', ?, 'OK', ?)`,
  ).run(
    `src-${randomUUID()}`,
    snapshot.provider,
    now,
    `Snapshot generato il ${snapshot.generatedAt}: ${snapshot.fixtures.length} partite, ${snapshot.statistics.length} statistiche, ${snapshot.odds.length} quote`,
  );

  return {
    competitions: snapshot.competitions.length,
    teams: snapshot.teams.length,
    fixtures: snapshot.fixtures.length,
    statistics: snapshot.statistics.length,
    odds: snapshot.odds.length,
    generatedAt: snapshot.generatedAt,
  };
}

/**
 * Bootstrap automatico: se il database è vuoto e la fonte attiva è reale,
 * importa lo snapshot incluso nel repository. Non fa chiamate di rete.
 */
export function seedRealSnapshotIfEmpty(db: DatabaseSync): SnapshotImportResult | null {
  const provider = process.env.DATA_PROVIDER?.trim();
  const auto =
    process.env.AUTO_SEED_REAL === "1" ||
    provider === "football-data-uk" ||
    provider === "open-data";
  if (!auto || process.env.AUTO_SEED_REAL === "0") return null;
  if (process.env.REAL_SNAPSHOT_DISABLE === "1") return null;

  const row = db.prepare("SELECT COUNT(*) AS n FROM competitions").get() as { n: number };
  if (row.n > 0) return null;

  const file = snapshotPath();
  if (!fs.existsSync(/* turbopackIgnore: true */ file)) return null;

  try {
    const snapshot = readSnapshot(file);
    if (!snapshot) return null;
    return importRealSnapshot(db, snapshot);
  } catch (error) {
    console.warn(`Snapshot reale non importato (${file}): ${(error as Error).message}`);
    return null;
  }
}
