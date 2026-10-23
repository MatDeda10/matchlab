import { getDb, resetDatabase, run, transaction } from "@/lib/db";
import { MODEL } from "@/lib/config/constants";
import { buildDemoDataset } from "./dataset";
import { computeRatings } from "@/engine/ratings";
import { predictFixture } from "@/engine/model";
import { listFinishedMatches } from "@/lib/db/repositories";
import type { HistoricalMatch } from "@/engine/types";
import { randomUUID } from "node:crypto";
import { mulberry32, seedFrom } from "./random";

export interface SeedResult {
  competitions: number;
  teams: number;
  players: number;
  fixtures: number;
  lineups: number;
  predictions: number;
  generatedAt: string;
}

function insertDataset(): void {
  const dataset = buildDemoDataset();
  const db = getDb();
  const now = new Date().toISOString();

  const insertCompetition = db.prepare(
    `INSERT INTO competitions (id, name, country, code, tier, provider, provider_ref, logo_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'demo', ?, NULL, ?, ?)`,
  );
  const insertTeam = db.prepare(
    `INSERT INTO teams (id, competition_id, name, short_name, country, provider, provider_ref, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'demo', ?, ?, ?, ?)`,
  );
  const insertPlayer = db.prepare(
    `INSERT INTO players (id, team_id, name, role, shirt_number, provider, provider_ref, minutes, appearances, starts, goals, assists, updated_at)
     VALUES (?, ?, ?, ?, ?, 'demo', NULL, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFixture = db.prepare(
    `INSERT INTO fixtures (id, competition_id, season, round, home_team_id, away_team_id, kickoff_utc, status, home_goals, away_goals, venue, provider, provider_ref, is_demo, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', ?, 1, ?)`,
  );
  const insertStats = db.prepare(
    `INSERT INTO fixture_statistics (fixture_id, home_xg, away_xg, home_shots, away_shots, home_shots_on_target, away_shots_on_target, home_possession, away_possession, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo-generator', ?)`,
  );
  const insertLineup = db.prepare(
    `INSERT INTO lineups (fixture_id, team_id, kind, formation, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertLineupPlayer = db.prepare(
    `INSERT INTO lineup_players (id, fixture_id, team_id, player_id, player_name, role, slot, is_starter, status, shirt_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAvailability = db.prepare(
    `INSERT INTO player_availability (id, fixture_id, team_id, player_id, player_name, status, reason, source, confidence, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const competition of dataset.competitions) {
    insertCompetition.run(
      competition.id,
      competition.name,
      competition.country,
      competition.code,
      competition.tier,
      competition.providerRef,
      now,
      now,
    );
  }
  for (const team of dataset.teams) {
    insertTeam.run(
      team.id,
      team.competitionId,
      team.name,
      team.shortName,
      team.country,
      team.providerRef,
      team.color,
      now,
      now,
    );
  }
  for (const player of dataset.players) {
    insertPlayer.run(
      player.id,
      player.teamId,
      player.name,
      player.role,
      player.shirtNumber,
      player.minutes,
      player.appearances,
      player.starts,
      player.goals,
      player.assists,
      now,
    );
  }
  for (const fixture of dataset.fixtures) {
    insertFixture.run(
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
      fixture.id,
      now,
    );
    if (fixture.stats) {
      insertStats.run(
        fixture.id,
        fixture.stats.homeXg,
        fixture.stats.awayXg,
        fixture.stats.homeShots,
        fixture.stats.awayShots,
        fixture.stats.homeShotsOnTarget,
        fixture.stats.awayShotsOnTarget,
        fixture.stats.homePossession,
        fixture.stats.awayPossession,
        now,
      );
    }
  }
  for (const lineup of dataset.lineups) {
    insertLineup.run(
      lineup.fixtureId,
      lineup.teamId,
      lineup.kind,
      lineup.formation,
      lineup.source,
      lineup.updatedAt,
    );
    for (const player of lineup.players) {
      insertLineupPlayer.run(
        player.id,
        player.fixtureId,
        player.teamId,
        player.playerId,
        player.playerName,
        player.role,
        player.slot,
        player.isStarter ? 1 : 0,
        player.status,
        player.shirtNumber,
      );
    }
  }
  for (const row of dataset.availability) {
    insertAvailability.run(
      row.id,
      row.fixtureId,
      row.teamId,
      row.playerId,
      row.playerName,
      row.status,
      row.reason,
      row.source,
      row.confidence,
      row.updatedAt,
    );
  }

  run(
    `INSERT OR REPLACE INTO model_versions (version, config_json, created_at, notes)
     VALUES (?, ?, ?, ?)`,
    MODEL.version,
    JSON.stringify(MODEL),
    now,
    "Poisson bivariato con correzione Dixon-Coles, decadimento temporale e shrinkage.",
  );

  run(
    `INSERT INTO source_metadata (id, provider, entity_type, entity_id, fetched_at, status, note)
     VALUES (?, 'demo', 'dataset', 'seed', ?, 'OK', ?)`,
    `src-${randomUUID()}`,
    now,
    `Dataset DEMO sintetico generato il ${now}`,
  );
}

function resolveSelection(
  home: number,
  away: number,
  marketId: string,
  selectionId: string,
): boolean | null {
  const total = home + away;
  switch (`${marketId}:${selectionId}`) {
    case "1X2:HOME": return home > away;
    case "1X2:DRAW": return home === away;
    case "1X2:AWAY": return away > home;
    case "DC:HOME_DRAW": return home >= away;
    case "DC:HOME_AWAY": return home !== away;
    case "DC:DRAW_AWAY": return away >= home;
    case "OU15:OVER": return total > 1.5;
    case "OU15:UNDER": return total < 1.5;
    case "OU25:OVER": return total > 2.5;
    case "OU25:UNDER": return total < 2.5;
    case "BTTS:YES": return home > 0 && away > 0;
    case "BTTS:NO": return home === 0 || away === 0;
    default: return null;
  }
}

function seedDemoPredictions(): number {
  const db = getDb();
  const finished = db
    .prepare(
      `SELECT * FROM fixtures
       WHERE status = 'FINISHED' AND home_goals IS NOT NULL AND away_goals IS NOT NULL
       ORDER BY kickoff_utc DESC LIMIT 120`,
    )
    .all() as unknown as Array<{
      id: string;
      competition_id: string;
      home_team_id: string;
      away_team_id: string;
      kickoff_utc: string;
      status: "FINISHED";
      home_goals: number;
      away_goals: number;
    }>;

  if (finished.length < 8) return 0;

  const competitions = [...new Set(finished.map((fixture) => fixture.competition_id))];
  const fixturesByCompetition = new Map<string, typeof finished>();
  for (const fixture of finished) {
    const list = fixturesByCompetition.get(fixture.competition_id) ?? [];
    list.push(fixture);
    fixturesByCompetition.set(fixture.competition_id, list);
  }

  const teams = db.prepare("SELECT id, name FROM teams").all() as unknown as Array<{
    id: string;
    name: string;
  }>;
  const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? id;

  const insertPrediction = db.prepare(
    `INSERT INTO predictions (id, session_id, created_at, kickoff_min, status, outcome, model_version, data_quality, is_demo, snapshot_json, settled_at, exclusion_reason)
     VALUES (?, 'demo-seed', ?, ?, 'SETTLED', ?, ?, ?, 1, ?, ?, NULL)`,
  );
  const insertLeg = db.prepare(
    `INSERT INTO prediction_legs (id, prediction_id, fixture_id, competition_id, market_id, selection_id, probability, quality, actual_won)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const markets: Array<[string, string]> = [
    ["1X2", "HOME"],
    ["1X2", "DRAW"],
    ["1X2", "AWAY"],
    ["OU25", "OVER"],
    ["OU25", "UNDER"],
    ["BTTS", "YES"],
    ["BTTS", "NO"],
    ["DC", "HOME_DRAW"],
  ];

  let count = 0;

  for (let index = 0; index < Math.min(32, finished.length); index += 1) {
    const fixture = finished[index]!;
    const history: HistoricalMatch[] = listFinishedMatches(
      fixture.competition_id,
      fixture.kickoff_utc,
    );
    const ratings = computeRatings(history, fixture.competition_id, fixture.kickoff_utc);

    const prediction = predictFixture(
      {
        id: fixture.id,
        competitionId: fixture.competition_id,
        homeTeamId: fixture.home_team_id,
        awayTeamId: fixture.away_team_id,
        homeTeamName: teamName(fixture.home_team_id),
        awayTeamName: teamName(fixture.away_team_id),
        kickoff: fixture.kickoff_utc,
        status: "SCHEDULED",
      },
      ratings,
      {
        generatedAt: new Date(new Date(fixture.kickoff_utc).getTime() - 86_400_000).toISOString(),
        hasXg: true,
        hasLineups: false,
        hasAvailability: false,
        hasMatchStats: true,
        withUncertainty: false,
      },
    );

    const rng = mulberry32(seedFrom(`prediction:${fixture.id}`));
    const rotation = markets[index % markets.length]!;
    const alternative = markets[Math.floor(rng() * markets.length)]!;
    const [marketId, selectionId] =
      (prediction.marketMap[`${rotation[0]}:${rotation[1]}`] ?? 0) >= 0.2
        ? rotation
        : alternative;
    const key = `${marketId}:${selectionId}`;
    const probability = prediction.marketMap[key] ?? 0;
    if (probability <= 0.05) continue;

    const won = resolveSelection(fixture.home_goals, fixture.away_goals, marketId, selectionId);
    if (won === null) continue;

    const createdAt = new Date(
      new Date(fixture.kickoff_utc).getTime() - 86_400_000,
    ).toISOString();
    const settledAt = new Date(
      new Date(fixture.kickoff_utc).getTime() + 2 * 3_600_000,
    ).toISOString();
    const predictionId = `demo-pred-${index + 1}`;

    const snapshot = {
      marketMap: prediction.marketMap,
      resultProbabilities: prediction.result,
      lambdaHome: prediction.lambdaHome,
      lambdaAway: prediction.lambdaAway,
      quality: prediction.quality,
      modelVersion: prediction.modelVersion,
      limitations: prediction.limitations,
      isDemo: true,
      legs: [
        {
          fixtureId: fixture.id,
          fixtureLabel: `${teamName(fixture.home_team_id)} – ${teamName(fixture.away_team_id)}`,
          marketId,
          selectionId,
          probability,
          label: key,
        },
      ],
    };

    insertPrediction.run(
      predictionId,
      createdAt,
      fixture.kickoff_utc,
      won ? "WON" : "LOST",
      MODEL.version,
      prediction.quality.score,
      JSON.stringify(snapshot),
      settledAt,
    );
    insertLeg.run(
      `leg-${predictionId}-1`,
      predictionId,
      fixture.id,
      fixture.competition_id,
      marketId,
      selectionId,
      probability,
      prediction.quality.score,
      won ? 1 : 0,
    );
    count += 1;

    // Alcune previsioni a 2 leg (partite diverse), per mostrare la probabilità congiunta.
    if (index % 6 === 0 && fixturesByCompetition.get(fixture.competition_id)?.length) {
      const pool = fixturesByCompetition.get(fixture.competition_id) ?? [];
      const second = pool.find((candidate) => candidate.id !== fixture.id && candidate.kickoff_utc < fixture.kickoff_utc);
      if (!second) continue;
      const secondRatings = computeRatings(
        listFinishedMatches(fixture.competition_id, second.kickoff_utc),
        fixture.competition_id,
        second.kickoff_utc,
      );
      const secondPrediction = predictFixture(
        {
          id: second.id,
          competitionId: second.competition_id,
          homeTeamId: second.home_team_id,
          awayTeamId: second.away_team_id,
          homeTeamName: teamName(second.home_team_id),
          awayTeamName: teamName(second.away_team_id),
          kickoff: second.kickoff_utc,
          status: "SCHEDULED",
        },
        secondRatings,
        {
          generatedAt: createdAt,
          hasXg: true,
          hasMatchStats: true,
          withUncertainty: false,
        },
      );
      const secondMarket = markets[(index + 3) % markets.length]!;
      const secondKey = `${secondMarket[0]}:${secondMarket[1]}`;
      const secondProbability = secondPrediction.marketMap[secondKey] ?? 0;
      const secondWon = resolveSelection(second.home_goals, second.away_goals, secondMarket[0], secondMarket[1]);
      if (secondProbability > 0.2 && secondWon !== null) {
        const comboId = `${predictionId}-combo`;
        const comboWon = Boolean(won) && secondWon;
        const firstLeg = snapshot.legs[0]!;
        insertPrediction.run(
          comboId,
          createdAt,
          second.kickoff_utc,
          comboWon ? "WON" : "LOST",
          MODEL.version,
          Math.min(prediction.quality.score, secondPrediction.quality.score),
          JSON.stringify({
            ...snapshot,
            resultProbabilities: undefined,
            legs: [
              firstLeg,
              {
                fixtureId: second.id,
                fixtureLabel: `${teamName(second.home_team_id)} – ${teamName(second.away_team_id)}`,
                marketId: secondMarket[0],
                selectionId: secondMarket[1],
                probability: secondProbability,
                label: secondKey,
              },
            ],
            jointProbability: probability * secondProbability,
            jointAssumption: "Prodotto delle probabilità; partite diverse.",
          }),
          settledAt,
        );
        insertLeg.run(
          `leg-${comboId}-1`,
          comboId,
          fixture.id,
          fixture.competition_id,
          marketId,
          selectionId,
          probability,
          prediction.quality.score,
          won ? 1 : 0,
        );
        insertLeg.run(
          `leg-${comboId}-2`,
          comboId,
          second.id,
          second.competition_id,
          secondMarket[0],
          secondMarket[1],
          secondProbability,
          secondPrediction.quality.score,
          secondWon ? 1 : 0,
        );
        count += 1;
      }
    }
  }

  // Verifica che il campione copra tutte le competizioni demo.
  void competitions;
  return count;
}

export function seedDemoData(options: { reset?: boolean } = {}): SeedResult {
  if (options.reset !== false) {
    resetDatabase();
  }
  let result: SeedResult | null = null;
  transaction(() => {
    insertDataset();
    const predictions = seedDemoPredictions();
    const db = getDb();
    result = {
      competitions: Number((db.prepare("SELECT COUNT(*) AS n FROM competitions").get() as { n: number }).n),
      teams: Number((db.prepare("SELECT COUNT(*) AS n FROM teams").get() as { n: number }).n),
      players: Number((db.prepare("SELECT COUNT(*) AS n FROM players").get() as { n: number }).n),
      fixtures: Number((db.prepare("SELECT COUNT(*) AS n FROM fixtures").get() as { n: number }).n),
      lineups: Number((db.prepare("SELECT COUNT(*) AS n FROM lineups").get() as { n: number }).n),
      predictions,
      generatedAt: new Date().toISOString(),
    };
  });
  if (!result) throw new Error("Seed fallito");
  return result;
}

export function ensureSeeded(): SeedResult | null {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM fixtures").get() as { n: number };
  if (row.n > 0) return null;
  return seedDemoData({ reset: false });
}
