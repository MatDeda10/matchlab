import { getDataSource } from "@/lib/api";
import { getDb, transaction } from "@/lib/db";
import { recordSourceMetadata } from "@/lib/db/repositories";
import { addDaysIso, isoDate } from "@/lib/dates";

export interface SyncResult {
  provider: string;
  competitions: number;
  teams: number;
  fixtures: number;
  unavailable: string[];
  warnings: string[];
  syncedAt: string;
}

/**
 * Sincronizzazione della fonte reale verso SQLite.
 *
 * Non inventa entità: inserisce solo ciò che il provider restituisce.
 * Se un endpoint non è supportato, lo segnala come UNAVAILABLE.
 */
export async function syncProviderData(options: {
  daysBack?: number;
  daysForward?: number;
} = {}): Promise<SyncResult> {
  const source = getDataSource();
  if (source.isDemo) {
    throw new Error(
      "La fonte attiva è DEMO: usa `npm run db:seed` per rigenerare il dataset sintetico. La sincronizzazione remota richiede DATA_PROVIDER=football-data.",
    );
  }

  const provider = source.provider;
  const daysBack = Math.max(0, options.daysBack ?? 30);
  const daysForward = Math.max(0, options.daysForward ?? 14);
  const today = isoDate(new Date());
  const from = `${addDaysIso(today, -daysBack)}T00:00:00.000Z`;
  const to = `${addDaysIso(today, daysForward)}T23:59:59.999Z`;

  const warnings: string[] = [];
  const unavailable: string[] = [];
  let competitionCount = 0;
  let teamCount = 0;
  let fixtureCount = 0;

  const competitionsResult = await provider.getCompetitions();
  if (competitionsResult.status !== "OK") {
    throw new Error(competitionsResult.reason);
  }

  const db = getDb();
  const now = new Date().toISOString();
  const upsertCompetition = db.prepare(
    `INSERT INTO competitions (id, name, country, code, tier, provider, provider_ref, logo_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, country = excluded.country,
       code = excluded.code, provider = excluded.provider, updated_at = excluded.updated_at`,
  );
  const upsertTeam = db.prepare(
    `INSERT INTO teams (id, competition_id, name, short_name, country, provider, provider_ref, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, short_name = excluded.short_name,
       competition_id = excluded.competition_id, updated_at = excluded.updated_at`,
  );
  const upsertFixture = db.prepare(
    `INSERT INTO fixtures (id, competition_id, season, round, home_team_id, away_team_id, kickoff_utc, status,
       home_goals, away_goals, venue, provider, provider_ref, is_demo, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status, home_goals = excluded.home_goals, away_goals = excluded.away_goals,
       kickoff_utc = excluded.kickoff_utc, round = excluded.round, venue = excluded.venue,
       updated_at = excluded.updated_at`,
  );

  const teamIds = new Set<string>();

  transaction(() => {
    for (const competition of competitionsResult.data) {
      upsertCompetition.run(
        competition.id,
        competition.name,
        competition.country,
        competition.code,
        competition.tier,
        provider.id,
        competition.code,
        now,
        now,
      );
      competitionCount += 1;
    }
  });

  const fixturesResult = await provider.getFixtures({ from, to });
  if (fixturesResult.status !== "OK") {
    unavailable.push(`Calendario: ${fixturesResult.reason}`);
    recordSourceMetadata({
      provider: provider.id,
      entityType: "fixtures",
      entityId: "*",
      status: "UNAVAILABLE",
      note: fixturesResult.reason,
    });
  } else {
    transaction(() => {
      for (const fixture of fixturesResult.data) {
        for (const team of [
          {
            id: fixture.homeTeamId,
            name: fixture.homeTeamName,
            short: fixture.homeTeamShort,
            color: fixture.homeColor,
          },
          {
            id: fixture.awayTeamId,
            name: fixture.awayTeamName,
            short: fixture.awayTeamShort,
            color: fixture.awayColor,
          },
        ]) {
          if (teamIds.has(team.id)) continue;
          upsertTeam.run(
            team.id,
            fixture.competitionId,
            team.name,
            team.short,
            fixture.competitionCode,
            provider.id,
            team.id,
            team.color,
            now,
            now,
          );
          teamIds.add(team.id);
          teamCount += 1;
        }

        upsertFixture.run(
          fixture.id,
          fixture.competitionId,
          fixture.season,
          fixture.round,
          fixture.homeTeamId,
          fixture.awayTeamId,
          fixture.kickoffUtc,
          fixture.status,
          fixture.homeGoals,
          fixture.awayGoals,
          fixture.venue,
          provider.id,
          fixture.id,
          now,
        );
        fixtureCount += 1;
      }
    });
    recordSourceMetadata({
      provider: provider.id,
      entityType: "fixtures",
      entityId: `${from}..${to}`,
      status: "OK",
      note: `${fixtureCount} partite`,
    });
  }

  if (!source.capabilities.lineups) {
    warnings.push("Formazioni non incluse dal provider: resteranno non disponibili.");
  }
  if (!source.capabilities.playerAvailability) {
    warnings.push("Infortuni e squalifiche non inclusi dal provider: resteranno non disponibili.");
  }
  if (!source.capabilities.matchStatistics) {
    warnings.push("Statistiche di partita non incluse dal provider.");
  }

  return {
    provider: provider.id,
    competitions: competitionCount,
    teams: teamCount,
    fixtures: fixtureCount,
    unavailable,
    warnings,
    syncedAt: new Date().toISOString(),
  };
}
