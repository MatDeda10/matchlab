import { MODEL } from "@/lib/config/constants";
import type {
  HistoricalMatch,
  RatingsConfig,
  RatingsModel,
  TeamRating,
} from "./types";

export const DEFAULT_RATINGS_CONFIG: RatingsConfig = {
  halfLifeDays: MODEL.halfLifeDays,
  shrinkageMatches: MODEL.shrinkageMatches,
  rho: MODEL.rho,
  maxGoals: MODEL.maxGoals,
  minMatches: 3,
  iterations: 14,
};

const MIN_RATING = 0.35;
const MAX_RATING = 2.8;
const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isUsable(match: HistoricalMatch): boolean {
  return (
    Number.isFinite(match.homeGoals) &&
    Number.isFinite(match.awayGoals) &&
    match.homeGoals >= 0 &&
    match.awayGoals >= 0 &&
    match.homeTeamId !== match.awayTeamId
  );
}

/**
 * Stima la forza offensiva/difensiva con un modello Poisson pesato nel tempo.
 *
 * Ipotesi:
 * - I gol di ogni squadra seguono una Poisson con media
 *   λ_home = mediaGolCasaLega × attack(home) × defence(away).
 * - La forza è relativa alla media della competizione (1 = media).
 * - Le partite recenti pesano di più (half-life configurabile).
 * - Le squadre con pochi dati vengono "shrinkate" verso la media (1).
 * - Le valutazioni sono aggiornate in modo iterativo (IPF), senza usare
 *   informazioni successive alla data `asOf`.
 */
export function computeRatings(
  matches: HistoricalMatch[],
  competitionId: string,
  asOf: string,
  config: Partial<RatingsConfig> = {},
): RatingsModel {
  const cfg: RatingsConfig = { ...DEFAULT_RATINGS_CONFIG, ...config };
  const asOfMs = new Date(asOf).getTime();
  const usable = matches.filter(
    (m) =>
      m.competitionId === competitionId &&
      isUsable(m) &&
      new Date(m.kickoff).getTime() < asOfMs,
  );

  const empty: RatingsModel = {
    competitionId,
    asOf,
    leagueHomeGoals: 1.45,
    leagueAwayGoals: 1.15,
    homeAdvantage: 1.45 / 1.15,
    teams: {},
    sampleMatches: 0,
    config: cfg,
  };
  if (usable.length === 0) return empty;

  const weights = new Map<string, number>();
  let weightSum = 0;
  let weightedHomeGoals = 0;
  let weightedAwayGoals = 0;

  for (const m of usable) {
    const ageDays = Math.max(0, (asOfMs - new Date(m.kickoff).getTime()) / DAY_MS);
    const weight = Math.max(0.05, Math.pow(0.5, ageDays / cfg.halfLifeDays));
    weights.set(m.id, weight);
    weightSum += weight;
    weightedHomeGoals += weight * m.homeGoals;
    weightedAwayGoals += weight * m.awayGoals;
  }

  // Medie gol della competizione (vantaggio casa incluso nelle due medie).
  const leagueHomeGoals = weightSum > 0 ? weightedHomeGoals / weightSum : 1.45;
  const leagueAwayGoals = weightSum > 0 ? weightedAwayGoals / weightSum : 1.15;

  const byTeam = new Map<string, HistoricalMatch[]>();
  for (const m of usable) {
    const home = byTeam.get(m.homeTeamId) ?? [];
    home.push(m);
    byTeam.set(m.homeTeamId, home);
    const away = byTeam.get(m.awayTeamId) ?? [];
    away.push(m);
    byTeam.set(m.awayTeamId, away);
  }

  const attack = new Map<string, number>();
  const defence = new Map<string, number>();
  const effectiveSample = new Map<string, number>();
  for (const [teamId, teamMatches] of byTeam) {
    attack.set(teamId, 1);
    defence.set(teamId, 1);
    effectiveSample.set(
      teamId,
      teamMatches.reduce((sum, m) => sum + (weights.get(m.id) ?? 0), 0),
    );
  }

  for (let iteration = 0; iteration < cfg.iterations; iteration += 1) {
    const nextAttack = new Map<string, number>(attack);
    const nextDefence = new Map<string, number>(defence);

    for (const [teamId, teamMatches] of byTeam) {
      let goalsFor = 0;
      let expectedFor = 0;
      let goalsAgainst = 0;
      let expectedAgainst = 0;

      for (const m of teamMatches) {
        const w = weights.get(m.id) ?? 0;
        const isHome = m.homeTeamId === teamId;
        const homeAttack = attack.get(m.homeTeamId) ?? 1;
        const awayAttack = attack.get(m.awayTeamId) ?? 1;
        const homeDefence = defence.get(m.homeTeamId) ?? 1;
        const awayDefence = defence.get(m.awayTeamId) ?? 1;

        const lambdaHome = leagueHomeGoals * homeAttack * awayDefence;
        const lambdaAway = leagueAwayGoals * awayAttack * homeDefence;
        const lambdaFor = isHome ? lambdaHome : lambdaAway;
        const lambdaAgainst = isHome ? lambdaAway : lambdaHome;

        goalsFor += w * (isHome ? m.homeGoals : m.awayGoals);
        expectedFor += w * lambdaFor;
        goalsAgainst += w * (isHome ? m.awayGoals : m.homeGoals);
        expectedAgainst += w * lambdaAgainst;
      }

      // Aggiornamento moltiplicativo (IPF): la forza cresce se la squadra
      // segna più di quanto il modello attuale si aspetti, e viceversa.
      // Ancorare il rapporto a 1 a ogni iterazione (come nella versione
      // precedente) produceva un feedback negativo e lambda irrealistici.
      if (expectedFor > 0) {
        const current = attack.get(teamId) ?? 1;
        nextAttack.set(teamId, clamp(current * (goalsFor / expectedFor), MIN_RATING, MAX_RATING));
      }
      if (expectedAgainst > 0) {
        const current = defence.get(teamId) ?? 1;
        nextDefence.set(
          teamId,
          clamp(current * (goalsAgainst / expectedAgainst), MIN_RATING, MAX_RATING),
        );
      }
    }

    // Identificabilità: attack e defence sono definiti a meno di una costante
    // di scala. Normalizziamo la media geometrica di attack a 1 e compensiamo
    // defence con la stessa costante, lasciando invariati i lambda.
    let logSum = 0;
    for (const value of nextAttack.values()) logSum += Math.log(value);
    const scale = Math.exp(logSum / Math.max(1, nextAttack.size));

    for (const [teamId, value] of nextAttack) {
      attack.set(teamId, clamp(value / scale, MIN_RATING, MAX_RATING));
    }
    for (const [teamId, value] of nextDefence) {
      defence.set(teamId, clamp(value * scale, MIN_RATING, MAX_RATING));
    }
  }

  const teams: Record<string, TeamRating> = {};
  for (const [teamId, teamMatches] of byTeam) {
    const n = effectiveSample.get(teamId) ?? 0;
    const shrink = n / (n + cfg.shrinkageMatches);
    const rawAttack = attack.get(teamId) ?? 1;
    const rawDefence = defence.get(teamId) ?? 1;
    teams[teamId] = {
      teamId,
      attack: clamp(1 + shrink * (rawAttack - 1), MIN_RATING, MAX_RATING),
      defence: clamp(1 + shrink * (rawDefence - 1), MIN_RATING, MAX_RATING),
      matches: teamMatches.length,
      effectiveSample: n,
    };
  }

  return {
    competitionId,
    asOf,
    leagueHomeGoals,
    leagueAwayGoals,
    homeAdvantage: leagueAwayGoals > 0 ? leagueHomeGoals / leagueAwayGoals : 1,
    teams,
    sampleMatches: usable.length,
    config: cfg,
  };
}

export function expectedGoals(
  ratings: RatingsModel,
  homeTeamId: string,
  awayTeamId: string,
): { lambdaHome: number; lambdaAway: number } {
  const home = ratings.teams[homeTeamId];
  const away = ratings.teams[awayTeamId];
  const homeAttack = home?.attack ?? 1;
  const homeDefence = home?.defence ?? 1;
  const awayAttack = away?.attack ?? 1;
  const awayDefence = away?.defence ?? 1;

  return {
    lambdaHome: clamp(
      ratings.leagueHomeGoals * homeAttack * awayDefence,
      0.15,
      4.5,
    ),
    lambdaAway: clamp(
      ratings.leagueAwayGoals * awayAttack * homeDefence,
      0.15,
      4.5,
    ),
  };
}
