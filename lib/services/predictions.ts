import { getDataSource } from "@/lib/api";
import { MARKETS, MODEL, type MarketId } from "@/lib/config/constants";
import {
  createPrediction,
  getFixture,
  listPredictions,
  settlePrediction,
} from "@/lib/db/repositories";
import type { FixtureDto, PredictionDto } from "@/lib/db/types";
import { marketKey, selectionLabel } from "@/engine/markets";
import { evaluatePredictions, type EvaluationResult, type PredictionRecord } from "@/engine/evaluation";
import type { OneXTwo } from "@/engine/types";
import { actualResult, resolveMarket } from "@/engine/resolve";
import { predictScheduledFixture } from "./model";

export interface SelectionInput {
  fixtureId: string;
  marketId: MarketId;
  selectionId: string;
}

export interface PredictionSnapshotLeg {
  fixtureId: string;
  fixtureLabel: string;
  competitionId: string;
  competitionName: string;
  kickoff: string;
  marketId: string;
  selectionId: string;
  probability: number;
  quality: number;
}

export interface PredictionSnapshot {
  version: 1;
  generatedAt: string;
  modelVersion: string;
  dataSource: string;
  isDemo: boolean;
  legs: PredictionSnapshotLeg[];
  jointProbability: number;
  jointAssumption: string;
  resultProb?: OneXTwo;
  limitations: string[];
}

export class SelectionError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "SelectionError";
    this.status = status;
  }
}

export function createPredictionFromSelections(
  sessionId: string,
  selections: SelectionInput[],
  now = new Date(),
): { id: string; snapshot: PredictionSnapshot } {
  if (selections.length === 0) throw new SelectionError("Nessuna selezione fornita.");
  if (selections.length > 6) throw new SelectionError("Massimo 6 selezioni per previsione.");
  const uniqueFixtures = new Set(selections.map((selection) => selection.fixtureId));
  if (uniqueFixtures.size !== selections.length) {
    throw new SelectionError(
      "Più selezioni sulla stessa partita non sono supportate: le probabilità sarebbero correlate.",
    );
  }

  const legs: PredictionSnapshotLeg[] = [];
  const limitations = new Set<string>();
  let singleResultProb: OneXTwo | undefined;

  for (const selection of selections) {
    const fixture = getFixture(selection.fixtureId);
    if (!fixture) throw new SelectionError(`Partita non trovata: ${selection.fixtureId}`, 404);
    const prediction = predictScheduledFixture(fixture, { now, withUncertainty: false });
    if (prediction.status !== "OK") throw new SelectionError(prediction.reason, 409);
    if (!(selection.marketId in MARKETS)) throw new SelectionError("Mercato non supportato.");
    const key = marketKey(selection.marketId, selection.selectionId);
    const probability = prediction.prediction.marketMap[key];
    if (!probability || probability <= 0) {
      throw new SelectionError(`Selezione non valutabile: ${key}`);
    }
    prediction.prediction.limitations.forEach((limitation) => limitations.add(limitation));
    legs.push({
      fixtureId: fixture.id,
      fixtureLabel: `${fixture.homeTeamName} – ${fixture.awayTeamName}`,
      competitionId: fixture.competitionId,
      competitionName: fixture.competitionName,
      kickoff: fixture.kickoffUtc,
      marketId: selection.marketId,
      selectionId: selection.selectionId,
      probability,
      quality: prediction.prediction.quality.score,
    });
    if (selections.length === 1) singleResultProb = prediction.prediction.result;
  }

  const jointProbability = legs.reduce((product, leg) => product * leg.probability, 1);
  const dataSource = getDataSource();
  const snapshot: PredictionSnapshot = {
    version: 1,
    generatedAt: now.toISOString(),
    modelVersion: MODEL.version,
    dataSource: dataSource.provider.id,
    isDemo: dataSource.isDemo,
    legs,
    jointProbability,
    jointAssumption:
      legs.length > 1
        ? "Prodotto delle probabilità; le partite sono distinte e trattate come indipendenti."
        : "Previsione singola.",
    resultProb: singleResultProb,
    limitations: [...limitations],
  };

  const id = createPrediction({
    sessionId,
    kickoffMin: legs.reduce(
      (min, leg) => (leg.kickoff < min ? leg.kickoff : min),
      legs[0]?.kickoff ?? now.toISOString(),
    ),
    modelVersion: MODEL.version,
    dataQuality: Math.min(...legs.map((leg) => leg.quality)),
    isDemo: dataSource.isDemo,
    snapshot,
    legs: legs.map((leg) => ({
      fixtureId: leg.fixtureId,
      competitionId: leg.competitionId,
      marketId: leg.marketId,
      selectionId: leg.selectionId,
      probability: leg.probability,
      quality: leg.quality,
    })),
  });

  return { id, snapshot };
}

export function settleFinishedPredictions(sessionId: string): number {
  const predictions = listPredictions(sessionId).filter(
    (prediction) => prediction.status === "OPEN",
  );
  let settled = 0;
  for (const prediction of predictions) {
    if (prediction.legs.length === 0) continue;
    const outcomes: Array<{ legId: string; won: boolean | null }> = [];
    let allFinished = true;
    for (const leg of prediction.legs) {
      const fixture = getFixture(leg.fixtureId);
      if (!fixture || fixture.status !== "FINISHED" || fixture.homeGoals === null || fixture.awayGoals === null) {
        allFinished = false;
        break;
      }
      const won = resolveMarket(fixture.homeGoals, fixture.awayGoals, leg.marketId, leg.selectionId);
      if (won === null) {
        allFinished = false;
        break;
      }
      outcomes.push({ legId: leg.id, won });
    }
    if (allFinished && outcomes.length === prediction.legs.length) {
      if (settlePrediction(prediction.id, sessionId, outcomes)) settled += 1;
    }
  }
  return settled;
}

interface SnapshotShape {
  legs?: PredictionSnapshotLeg[];
  resultProb?: OneXTwo;
  jointProbability?: number;
}

function snapshotOf(prediction: PredictionDto): SnapshotShape {
  const value = prediction.snapshot;
  if (!value || typeof value !== "object") return {};
  return value as SnapshotShape;
}

export interface MetricsSummary {
  evaluation: EvaluationResult;
  exclusions: {
    open: number;
    voided: number;
    unresolvedLegs: number;
    missingSnapshot: number;
  };
  competitions: Record<string, string>;
}

export function metricsFor(predictions: PredictionDto[]): MetricsSummary {
  const fixtures = new Map<string, FixtureDto>();
  const competitionNames: Record<string, string> = {};
  let unresolvedLegs = 0;
  let missingSnapshot = 0;

  const records: PredictionRecord[] = [];
  for (const prediction of predictions) {
    if (prediction.status !== "SETTLED") continue;
    const snapshot = snapshotOf(prediction);
    if (!snapshot.legs || !Array.isArray(snapshot.legs)) {
      missingSnapshot += 1;
      continue;
    }
    const legs = prediction.legs
      .filter((leg) => leg.actualWon !== null)
      .map((leg) => ({
        key: `${leg.marketId}:${leg.selectionId}`,
        marketId: leg.marketId,
        competitionId: leg.competitionId,
        probability: leg.probability,
        won: leg.actualWon === true,
      }));

    unresolvedLegs += prediction.legs.filter((leg) => leg.actualWon === null).length;
    if (legs.length === 0) continue;

    let resultProb: OneXTwo | undefined;
    let actual: "HOME" | "DRAW" | "AWAY" | undefined;
    if (prediction.legs.length === 1) {
      const leg = prediction.legs[0]!;
      let fixture = fixtures.get(leg.fixtureId);
      if (!fixture) {
        fixture = getFixture(leg.fixtureId) ?? undefined;
        if (fixture) fixtures.set(leg.fixtureId, fixture);
        if (fixture) competitionNames[fixture.competitionId] = fixture.competitionName;
      }
      if (snapshot.resultProb) resultProb = snapshot.resultProb;
      if (fixture?.status === "FINISHED" && fixture.homeGoals !== null && fixture.awayGoals !== null) {
        actual = actualResult(fixture.homeGoals, fixture.awayGoals);
      }
    }

    records.push({
      id: prediction.id,
      createdAt: prediction.createdAt,
      legs,
      resultProbabilities: resultProb,
      actualResult: actual,
    });
  }

  return {
    evaluation: evaluatePredictions(records, { sampleWarningThreshold: 30 }),
    exclusions: {
      open: predictions.filter((prediction) => prediction.status === "OPEN").length,
      voided: predictions.filter((prediction) => prediction.status === "VOID").length,
      unresolvedLegs,
      missingSnapshot,
    },
    competitions: competitionNames,
  };
}

export function selectionDisplayName(marketId: string, selectionId: string): string {
  const market = MARKETS[marketId as MarketId];
  return `${market?.short ?? marketId} · ${selectionLabel(marketId as MarketId, selectionId)}`;
}

export function legProbability(prediction: PredictionDto, legIndex: number): number {
  return prediction.legs[legIndex]?.probability ?? 0;
}

export function selectionKey(marketId: string, selectionId: string): string {
  return `${marketId}:${selectionId}`;
}
