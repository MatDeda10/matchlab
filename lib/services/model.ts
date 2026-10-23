import { addDaysIso, isoDate } from "@/lib/dates";
import { getDataSource } from "@/lib/api";
import {
  getAvailability,
  getFixture,
  getFixtureStatistics,
  getLastMatchDate,
  getLineups,
  listFinishedMatches,
} from "@/lib/db/repositories";
import type { FixtureDto } from "@/lib/db/types";
import { computeRatings } from "@/engine/ratings";
import { daysSince, predictFixture } from "@/engine/model";
import type { FixturePrediction, RatingsModel } from "@/engine/types";

interface CachedRatings {
  expiresAt: number;
  value: RatingsModel;
}

const ratingsCache = new Map<string, CachedRatings>();
const TTL_MS = 10 * 60 * 1000;

export function ratingsForCompetition(
  competitionId: string,
  asOf = new Date(),
): RatingsModel {
  const key = `${competitionId}|${isoDate(asOf)}`;
  const existing = ratingsCache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;

  const asOfIso = asOf.toISOString();
  const matches = listFinishedMatches(competitionId, asOfIso);
  const value = computeRatings(matches, competitionId, asOfIso);
  ratingsCache.set(key, { expiresAt: Date.now() + TTL_MS, value });
  return value;
}

export function clearRatingsCache(): void {
  ratingsCache.clear();
}

export interface PredictionAvailability {
  status: "OK";
  prediction: FixturePrediction;
}

export interface PredictionUnavailable {
  status: "UNAVAILABLE";
  reason: string;
}

export function predictScheduledFixture(
  fixture: FixtureDto,
  options: { now?: Date; withUncertainty?: boolean } = {},
): PredictionAvailability | PredictionUnavailable {
  if (fixture.status !== "SCHEDULED") {
    return {
      status: "UNAVAILABLE",
      reason: `La partita è in stato ${fixture.status}: le stime pre-partita non vengono mostrate.`,
    };
  }

  const now = options.now ?? new Date();
  const ratings = ratingsForCompetition(fixture.competitionId, now);
  if (ratings.sampleMatches < 5) {
    return {
      status: "UNAVAILABLE",
      reason: "Storico insufficiente per stimare le forze delle squadre in questa competizione.",
    };
  }

  const capabilities = getDataSource().capabilities;
  const lineups = getLineups(fixture.id);
  const hasLineups = lineups.some((lineup) => lineup.kind === "PROBABLE" || lineup.kind === "OFFICIAL");
  const availability = getAvailability(fixture.id);
  const stats = getFixtureStatistics(fixture.id);

  const prediction = predictFixture(
    {
      id: fixture.id,
      competitionId: fixture.competitionId,
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      homeTeamName: fixture.homeTeamName,
      awayTeamName: fixture.awayTeamName,
      kickoff: fixture.kickoffUtc,
      status: fixture.status,
    },
    ratings,
    {
      daysSinceLastMatch: {
        home: daysSince(getLastMatchDate(fixture.homeTeamId, `${fixture.kickoffUtc}`), now),
        away: daysSince(getLastMatchDate(fixture.awayTeamId, `${fixture.kickoffUtc}`), now),
      },
      hasXg: capabilities.xg,
      hasLineups,
      hasAvailability: availability.length > 0,
      hasMatchStats: capabilities.matchStatistics && Boolean(stats),
      withUncertainty: options.withUncertainty ?? true,
      generatedAt: now.toISOString(),
    },
  );

  return { status: "OK", prediction };
}

export function defaultGeneratorWindow(): { from: string; to: string } {
  const today = isoDate(new Date());
  return { from: today, to: addDaysIso(today, 7) };
}

export function fixtureWindow(fixture: FixtureDto): {
  from: string;
  to: string;
} {
  return { from: isoDate(new Date(fixture.kickoffUtc)), to: isoDate(new Date(fixture.kickoffUtc)) };
}

export { getFixture };
