import { MARKETS, MODEL, RISK_PROFILES, type MarketId, type RiskProfileId } from "@/lib/config/constants";
import { getDataSource } from "@/lib/api";
import { listCompetitions, listFixtures } from "@/lib/db/repositories";
import type { FixtureDto } from "@/lib/db/types";
import { generateProposals } from "@/engine/combination";
import { marketKey, MARKET_SELECTIONS, selectionLabel } from "@/engine/markets";
import type { GenerationResult, SelectionCandidate } from "@/engine/types";
import { predictScheduledFixture } from "./model";

export interface GeneratorInput {
  dateFrom: string;
  dateTo: string;
  competitionIds: string[];
  budget: number | null;
  events: number;
  profile: RiskProfileId;
  markets: MarketId[];
  maxPerCompetition: number | null;
  minDataQuality: number | null;
  notes?: string;
}

export interface GeneratorContext {
  dateFrom: string;
  dateTo: string;
  competitionIds: string[];
  competitionNames: string[];
  fixturesFound: number;
  fixturesEvaluated: number;
  budget: number | null;
  profileLabel: string;
  isDemo: boolean;
  notes: string;
  warnings: string[];
}

export interface GeneratorResponse {
  result: GenerationResult;
  context: GeneratorContext;
}

function isInsufficientCandidate(
  fixture: FixtureDto,
  reason: string,
): { fixtureId: string; fixtureLabel: string; reason: string } {
  return {
    fixtureId: fixture.id,
    fixtureLabel: `${fixture.homeTeamName} – ${fixture.awayTeamName}`,
    reason,
  };
}

/**
 * Orchestrazione server-side del generatore.
 * Le probabilità sono calcolate dal motore deterministico; nessun LLM.
 */
export function runGeneration(input: GeneratorInput, now = new Date()): GeneratorResponse {
  const profile = RISK_PROFILES[input.profile] ?? RISK_PROFILES.balanced;
  const competitions = listCompetitions();
  const competitionNames = competitions
    .filter((competition) => input.competitionIds.includes(competition.id))
    .map((competition) => competition.name);

  const fixtures = listFixtures({
    from: `${input.dateFrom}T00:00:00.000Z`,
    to: `${input.dateTo}T23:59:59.999Z`,
    competitionIds: input.competitionIds.length > 0 ? input.competitionIds : undefined,
    statuses: ["SCHEDULED"],
    limit: 120,
    order: "asc",
  }).slice(0, 60);

  const candidates: SelectionCandidate[] = [];
  const excluded: Array<{ fixtureId: string; fixtureLabel: string; reason: string }> = [];
  let evaluated = 0;

  for (const fixture of fixtures) {
    const prediction = predictScheduledFixture(fixture, { now, withUncertainty: true });
    if (prediction.status !== "OK") {
      excluded.push(isInsufficientCandidate(fixture, prediction.reason));
      continue;
    }
    evaluated += 1;
    if (prediction.prediction.quality.score < (input.minDataQuality ?? profile.minDataQuality)) {
      excluded.push(
        isInsufficientCandidate(
          fixture,
          `Qualità del dato ${prediction.prediction.quality.score}/100 sotto la soglia ${input.minDataQuality ?? profile.minDataQuality}.`,
        ),
      );
      continue;
    }

    for (const marketId of input.markets) {
      for (const selectionId of MARKET_SELECTIONS[marketId] ?? []) {
        const key = marketKey(marketId, selectionId);
        const probability = prediction.prediction.marketMap[key] ?? 0;
        if (probability <= 0) continue;
        candidates.push({
          fixtureId: fixture.id,
          competitionId: fixture.competitionId,
          kickoff: fixture.kickoffUtc,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeTeamName: fixture.homeTeamName,
          awayTeamName: fixture.awayTeamName,
          marketId,
          selectionId,
          label: selectionLabel(marketId, selectionId),
          probability,
          quality: prediction.prediction.quality,
          interval: prediction.prediction.uncertainty[key] ?? null,
          modelVersion: prediction.prediction.modelVersion,
        });
      }
    }
  }

  const result = generateProposals(
    candidates,
    {
      events: input.events,
      profile: input.profile,
      markets: input.markets,
      maxPerCompetition: input.maxPerCompetition ?? undefined,
      minDataQuality: input.minDataQuality ?? undefined,
    },
    now,
  );

  const warnings: string[] = [];
  const dataSource = getDataSource();
  if (dataSource.isDemo) {
    warnings.push("Dataset DEMO: le probabilità non riguardano partite reali.");
  }
  if (input.budget !== null) {
    warnings.push(
      "Il budget è solo informativo: non modifica probabilità, selezione o numero di eventi. Non è possibile stimare un valore atteso senza quote.",
    );
  }
  if (!dataSource.capabilities.lineups) {
    warnings.push(
      "Formazioni e indisponibili non sono disponibili con questo provider: il modello usa solo i risultati storici.",
    );
  }
  warnings.push(
    "Nessuna quota è stata utilizzata. Non viene calcolato ROI, rendimento atteso o convenienza.",
  );

  return {
    result: {
      ...result,
      excluded: [...excluded, ...result.excluded].slice(0, 24),
      modelVersions: result.modelVersions.length > 0 ? result.modelVersions : [MODEL.version],
    },
    context: {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      competitionIds: input.competitionIds,
      competitionNames,
      fixturesFound: fixtures.length,
      fixturesEvaluated: evaluated,
      budget: input.budget,
      profileLabel: profile.label,
      isDemo: dataSource.isDemo,
      notes: input.notes?.trim() ?? "",
      warnings,
    },
  };
}

export const SUPPORTED_MARKET_LABELS = Object.fromEntries(
  Object.entries(MARKETS).map(([id, market]) => [id, market.label]),
) as Record<MarketId, string>;
