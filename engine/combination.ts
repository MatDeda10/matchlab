import { RISK_PROFILES, type MarketId, type RiskProfileId } from "@/lib/config/constants";
import type {
  GenerationResult,
  ProposalLeg,
  ScenarioProposal,
  SelectionCandidate,
} from "./types";
import { explainLeg, explainScenario, scenarioRationale } from "./explanations";

export interface GenerationOptions {
  events: number;
  profile: RiskProfileId;
  markets: MarketId[];
  maxPerCompetition?: number;
  minDataQuality?: number;
  minLegProbability?: number;
  beamWidth?: number;
}

interface BeamState {
  legs: SelectionCandidate[];
  logProbability: number;
  perCompetition: Record<string, number>;
  usedFixtures: Set<string>;
}

function scoreState(state: BeamState, uncertaintyPenalty: number): number {
  if (state.legs.length === 0) return Number.NEGATIVE_INFINITY;
  const meanSpread =
    state.legs.reduce((sum, leg) => sum + (leg.interval?.spread ?? 0.15), 0) /
    state.legs.length;
  const meanQuality =
    state.legs.reduce((sum, leg) => sum + leg.quality.score, 0) / state.legs.length;
  return (
    state.logProbability -
    uncertaintyPenalty * meanSpread +
    0.25 * ((meanQuality - 50) / 50)
  );
}

function candidateKey(candidate: SelectionCandidate): string {
  return `${candidate.fixtureId}|${candidate.marketId}|${candidate.selectionId}`;
}

/**
 * Generatore combinatorio con pruning.
 *
 * Vincoli:
 * - una sola leg per partita (evita di moltiplicare mercati correlati);
 * - limite di leg per competizione;
 * - soglie minime di probabilità e qualità del dato.
 *
 * Non genera tutte le combinazioni possibili: usa una beam search limitata.
 */
export function generateProposals(
  candidates: SelectionCandidate[],
  options: GenerationOptions,
  now = new Date(),
): GenerationResult {
  const profile = RISK_PROFILES[options.profile] ?? RISK_PROFILES.balanced;
  const minProbability = options.minLegProbability ?? profile.minLegProbability;
  const minQuality = options.minDataQuality ?? profile.minDataQuality;
  const beamWidth = options.beamWidth ?? 350;
  const events = Math.max(1, Math.min(10, Math.round(options.events)));
  const allowedMarkets = new Set<MarketId>(options.markets);

  const eligible = candidates.filter(
    (c) =>
      allowedMarkets.has(c.marketId) &&
      c.probability >= minProbability &&
      c.probability < 1 &&
      c.quality.score >= minQuality &&
      new Date(c.kickoff).getTime() > now.getTime(),
  );

  const byFixture = new Map<string, SelectionCandidate[]>();
  const allByFixture = new Map<string, SelectionCandidate[]>();
  for (const candidate of candidates) {
    if (
      allowedMarkets.has(candidate.marketId) &&
      candidate.probability > 0 &&
      new Date(candidate.kickoff).getTime() > now.getTime()
    ) {
      const all = allByFixture.get(candidate.fixtureId) ?? [];
      all.push(candidate);
      allByFixture.set(candidate.fixtureId, all);
    }
    if (
      allowedMarkets.has(candidate.marketId) &&
      candidate.probability >= minProbability &&
      candidate.probability < 1 &&
      candidate.quality.score >= minQuality &&
      new Date(candidate.kickoff).getTime() > now.getTime()
    ) {
      const group = byFixture.get(candidate.fixtureId) ?? [];
      group.push(candidate);
      byFixture.set(candidate.fixtureId, group);
    }
  }

  const groups = [...byFixture.entries()]
    .map(([fixtureId, group]) => ({
      fixtureId,
      candidates: group
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 4),
      best: Math.max(...group.map((c) => c.probability)),
    }))
    .sort((a, b) => b.best - a.best)
    .slice(0, Math.max(events * 8, 24));

  const assumptions = [
    "Le leg appartengono a partite distinte: la probabilità congiunta è il prodotto delle stime, assumendo indipendenza condizionata.",
    "Le probabilità sono stime del modello Poisson/Dixon-Coles, non quote e non frequenze garantite.",
    "Nessuna soglia è stata abbassata automaticamente per produrre uno scenario.",
  ];

  if (groups.length < events) {
    return {
      status: "INSUFFICIENT",
      proposals: [],
      message: `Non ci sono abbastanza partite valutabili (${groups.length}) per costruire uno scenario da ${events} eventi con i criteri scelti. Riduci gli eventi o amplia l'intervallo/mercati.`,
      excluded: [],
      candidatesEvaluated: eligible.length,
      generatedAt: now.toISOString(),
      modelVersions: [...new Set(candidates.map((c) => c.modelVersion))],
      assumptions,
    };
  }

  const baseMaxPerCompetition = options.maxPerCompetition ?? profile.maxLegsPerCompetition;
  const maxPerCompetition = Math.max(1, Math.min(events, baseMaxPerCompetition));
  if (options.maxPerCompetition === undefined) {
    assumptions.push(
      `Il profilo limita a ${maxPerCompetition} leg per competizione; il vincolo non viene ampliato automaticamente.`,
    );
  }

  let beam: BeamState[] = [
    { legs: [], logProbability: 0, perCompetition: {}, usedFixtures: new Set() },
  ];

  for (const group of groups) {
    const next: BeamState[] = [...beam];
    for (const state of beam) {
      if (state.legs.length >= events) continue;
      for (const candidate of group.candidates) {
        if (state.usedFixtures.has(candidate.fixtureId)) continue;
        const count = state.perCompetition[candidate.competitionId] ?? 0;
        if (count >= maxPerCompetition) continue;
        next.push({
          legs: [...state.legs, candidate],
          logProbability: state.logProbability + Math.log(candidate.probability),
          perCompetition: {
            ...state.perCompetition,
            [candidate.competitionId]: count + 1,
          },
          usedFixtures: new Set([...state.usedFixtures, candidate.fixtureId]),
        });
      }
    }
    beam = next
      .sort((a, b) => scoreState(b, profile.uncertaintyPenalty) - scoreState(a, profile.uncertaintyPenalty))
      .slice(0, beamWidth);
  }

  const complete = beam
    .filter((state) => state.legs.length === events)
    .sort((a, b) => scoreState(b, profile.uncertaintyPenalty) - scoreState(a, profile.uncertaintyPenalty));

  const seen = new Set<string>();
  const proposals: ScenarioProposal[] = [];

  for (const state of complete) {
    const signature = state.legs
      .map(candidateKey)
      .sort()
      .join("~");
    if (seen.has(signature)) continue;
    seen.add(signature);

    const jointProbability = state.legs.reduce((product, leg) => product * leg.probability, 1);
    const averageQuality =
      state.legs.reduce((sum, leg) => sum + leg.quality.score, 0) / state.legs.length;
    const worstQuality = Math.min(...state.legs.map((leg) => leg.quality.score));
    const uncertaintySpread =
      state.legs.reduce((sum, leg) => sum + (leg.interval?.spread ?? 0.15), 0) /
      state.legs.length;

    const proposalLegs: ProposalLeg[] = state.legs.map((leg) => {
      const group = allByFixture.get(leg.fixtureId) ?? [];
      const alternatives = group
        .filter((c) => candidateKey(c) !== candidateKey(leg))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 2)
        .map((c) => ({
          selectionId: `${c.marketId}:${c.selectionId}`,
          label: `${c.marketId} · ${c.selectionId}`,
          probability: c.probability,
          deltaJoint: jointProbability * (c.probability / leg.probability) - jointProbability,
        }));

      return {
        fixtureId: leg.fixtureId,
        competitionId: leg.competitionId,
        kickoff: leg.kickoff,
        fixtureLabel: `${leg.homeTeamName} – ${leg.awayTeamName}`,
        marketId: leg.marketId,
        marketLabel: leg.marketId,
        selectionId: leg.selectionId,
        selectionLabel: leg.label,
        probability: leg.probability,
        qualityScore: leg.quality.score,
        uncertainty: leg.interval,
        rationale: explainLeg({
          fixtureLabel: `${leg.homeTeamName} – ${leg.awayTeamName}`,
          marketId: leg.marketId,
          selectionId: leg.selectionId,
          probability: leg.probability,
          qualityScore: leg.quality.score,
          uncertainty: leg.interval,
        }),
        alternatives,
      };
    });

    const proposal: ScenarioProposal = {
      id: `gen-${proposals.length + 1}`,
      legs: proposalLegs,
      jointProbability,
      jointAssumption:
        "Prodotto delle probabilità individuali; valido solo sotto ipotesi di indipendenza condizionata tra partite diverse.",
      averageQuality,
      worstQuality,
      uncertaintySpread,
      score: scoreState(state, profile.uncertaintyPenalty),
      rationale: "",
    };
    proposal.rationale = `${explainScenario(
      proposalLegs,
      jointProbability,
      Math.min(...proposalLegs.map((leg) => leg.probability)),
    )} ${scenarioRationale(proposal)}`;
    proposals.push(proposal);
    if (proposals.length >= 3) break;
  }

  if (proposals.length === 0) {
    return {
      status: "INSUFFICIENT",
      proposals: [],
      message: `Con i criteri scelti non è possibile costruire una combinazione da ${events} eventi. Prova ad ampliare le date, ridurre gli eventi o usare il profilo Bilanciato.`,
      excluded: [],
      candidatesEvaluated: eligible.length,
      generatedAt: now.toISOString(),
      modelVersions: [...new Set(candidates.map((c) => c.modelVersion))],
      assumptions,
    };
  }

  return {
    status: "OK",
    proposals,
    message: `${proposals.length} scenari generati da ${eligible.length} selezioni valutabili su ${groups.length} partite.`,
    excluded: [],
    candidatesEvaluated: eligible.length,
    generatedAt: now.toISOString(),
    modelVersions: [...new Set(candidates.map((c) => c.modelVersion))],
    assumptions,
  };
}

/** Prodotto delle probabilità, con controllo di partite duplicate. */
export function jointProbability(probabilities: number[]): number {
  return probabilities.reduce((product, p) => product * p, 1);
}

export function combinationsCount(n: number, k: number): number {
  if (k > n || k < 0) return 0;
  let result = 1;
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
  }
  return Math.round(result);
}
