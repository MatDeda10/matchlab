import { listFixtures } from "@/lib/db/repositories";
import type { FixtureDto } from "@/lib/db/types";

export interface FormEntry {
  fixtureId: string;
  kickoff: string;
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
}

export interface SideSummary {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  pointsPerGame: number;
  form: FormEntry[];
}

export interface TeamSummary {
  teamId: string;
  overall: SideSummary;
  home: SideSummary;
  away: SideSummary;
}

function emptySide(): SideSummary {
  return {
    played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
    pointsPerGame: 0, form: [],
  };
}

function addMatch(side: SideSummary, entry: FormEntry): void {
  side.played += 1;
  side.goalsFor += entry.goalsFor;
  side.goalsAgainst += entry.goalsAgainst;
  if (entry.result === "W") side.won += 1;
  else if (entry.result === "D") side.drawn += 1;
  else side.lost += 1;
  side.form.push(entry);
}

function finish(side: SideSummary): SideSummary {
  side.pointsPerGame = side.played > 0 ? (side.won * 3 + side.drawn) / side.played : 0;
  side.form = side.form.slice(-5).reverse();
  return side;
}

export function teamSummary(
  teamId: string,
  competitionId: string,
  before: string,
  limit = 30,
): TeamSummary {
  const fixtures = listFixtures({
    teamId,
    competitionIds: [competitionId],
    statuses: ["FINISHED"],
    to: before,
    limit,
    order: "desc",
  }).filter(
    (fixture): fixture is FixtureDto & { homeGoals: number; awayGoals: number } =>
      fixture.homeGoals !== null && fixture.awayGoals !== null,
  );

  const overall = emptySide();
  const home = emptySide();
  const away = emptySide();

  for (const fixture of fixtures) {
    const isHome = fixture.homeTeamId === teamId;
    const goalsFor = isHome ? fixture.homeGoals : fixture.awayGoals;
    const goalsAgainst = isHome ? fixture.awayGoals : fixture.homeGoals;
    const entry: FormEntry = {
      fixtureId: fixture.id,
      kickoff: fixture.kickoffUtc,
      opponent: isHome ? fixture.awayTeamName : fixture.homeTeamName,
      isHome,
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
    };
    addMatch(overall, entry);
    addMatch(isHome ? home : away, entry);
  }

  return {
    teamId,
    overall: finish(overall),
    home: finish(home),
    away: finish(away),
  };
}

export function headToHead(
  homeTeamId: string,
  awayTeamId: string,
  competitionId: string,
  before: string,
  limit = 6,
): FixtureDto[] {
  return listFixtures({
    teamId: homeTeamId,
    competitionIds: [competitionId],
    statuses: ["FINISHED"],
    to: before,
    limit: 60,
    order: "desc",
  })
    .filter(
      (fixture) =>
        (fixture.homeTeamId === homeTeamId && fixture.awayTeamId === awayTeamId) ||
        (fixture.homeTeamId === awayTeamId && fixture.awayTeamId === homeTeamId),
    )
    .slice(0, limit);
}

export function matchLabel(fixture: FixtureDto): string {
  return `${fixture.homeTeamName} – ${fixture.awayTeamName}`;
}
