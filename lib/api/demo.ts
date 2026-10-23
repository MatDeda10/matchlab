import {
  getAvailability,
  getFixture,
  getFixtureStatistics,
  getLineups,
  listCompetitions,
  listFixtures,
  listTeams,
} from "@/lib/db/repositories";
import type { AvailabilityDto, CompetitionDto, FixtureDto, FixtureStatisticsDto, TeamDto } from "@/lib/db/types";
import {
  ok,
  unavailable,
  type FixtureQuery,
  type FootballDataProvider,
  type ProviderCapabilities,
  type ProviderResult,
} from "./provider";

/**
 * Provider DEMO: legge dal database SQLite popolato da `npm run db:seed`.
 * Non effettua chiamate di rete. Tutti i dati sono sintetici e marcati is_demo.
 */
export class DemoProvider implements FootballDataProvider {
  readonly id = "demo";
  readonly label = "Dataset DEMO (sintetico)";
  readonly isDemo = true;
  readonly capabilities: ProviderCapabilities = {
    fixtures: true,
    results: true,
    standings: true,
    lineups: true,
    probableLineups: true,
    playerAvailability: true,
    matchStatistics: true,
    xg: true,
    players: true,
    historicalMatches: true,
    odds: false,
  };
  readonly limitations = [
    "Tutti i dati sono generati sinteticamente: nessuna squadra, partita o statistica è reale.",
    "Le formazioni e gli indisponibili sono simulati per mostrare le funzionalità della UI.",
    "Non usare questo dataset per decisioni reali o per valutare il modello su dati reali.",
  ];
  readonly quotaNote = "Nessuna chiamata esterna: nessun limite di quota.";

  async getCompetitions(): Promise<ProviderResult<CompetitionDto[]>> {
    return ok(this.id, listCompetitions());
  }

  async getFixtures(query: FixtureQuery): Promise<ProviderResult<FixtureDto[]>> {
    const competitions = listCompetitions();
    const ids = query.competitionCodes
      ?.map((code) => competitions.find((competition) => competition.code === code)?.id)
      .filter((id): id is string => Boolean(id));
    const fixtures = listFixtures({
      from: `${query.from}T00:00:00.000Z`,
      to: `${query.to}T23:59:59.999Z`,
      competitionIds: ids && ids.length > 0 ? ids : undefined,
      limit: 500,
    });
    return ok(this.id, fixtures);
  }

  async getFixtureDetails(id: string): Promise<ProviderResult<FixtureDto>> {
    const fixture = getFixture(id);
    if (!fixture) return unavailable(this.id, "Partita non trovata nel dataset demo.");
    return ok(this.id, fixture);
  }

  async getHistoricalMatches(
    competitionId: string,
    from: string,
    to: string,
  ): Promise<ProviderResult<FixtureDto[]>> {
    const fixtures = listFixtures({
      competitionIds: [competitionId],
      from: `${from}T00:00:00.000Z`,
      to: `${to}T23:59:59.999Z`,
      statuses: ["FINISHED"],
      limit: 500,
    });
    return ok(this.id, fixtures);
  }

  async getTeams(competitionId: string): Promise<ProviderResult<TeamDto[]>> {
    return ok(this.id, listTeams(competitionId));
  }

  async getTeamStatistics(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Statistiche aggregate calcolate dai risultati nel layer applicativo.");
  }

  async getTeamPlayers(_teamId: string): Promise<ProviderResult<never>> {
    return unavailable(this.id, "Rose disponibili nel database demo, non esposte da questo metodo.");
  }

  async getPlayerAvailability(fixtureId: string): Promise<ProviderResult<AvailabilityDto[]>> {
    return ok(this.id, getAvailability(fixtureId));
  }

  async getProbableLineups(fixtureId: string): Promise<ProviderResult<ReturnType<typeof getLineups>>> {
    return ok(this.id, getLineups(fixtureId).filter((lineup) => lineup.kind === "PROBABLE"));
  }

  async getOfficialLineups(fixtureId: string): Promise<ProviderResult<ReturnType<typeof getLineups>>> {
    return ok(this.id, getLineups(fixtureId).filter((lineup) => lineup.kind === "OFFICIAL"));
  }

  async getFixtureStatistics(
    fixtureId: string,
  ): Promise<ProviderResult<FixtureStatisticsDto>> {
    const stats = getFixtureStatistics(fixtureId);
    if (!stats) return unavailable(this.id, "Statistiche demo non disponibili per questa partita.");
    return ok(this.id, stats);
  }
}
