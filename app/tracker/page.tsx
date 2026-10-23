import { AlertTriangle, Target } from "lucide-react";
import { getPreferences, getFixture, listPredictions } from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import { nowMs } from "@/lib/clock";
import {
  metricsFor,
  selectionDisplayName,
  type PredictionSnapshot,
} from "@/lib/services/predictions";
import type { PredictionDto } from "@/lib/db/types";
import { TrackerBoard, type TrackerPrediction } from "@/components/tracker-board";
import { Alert, Disclaimer, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function mapPrediction(prediction: PredictionDto, now: number): TrackerPrediction {
  const snapshot =
    prediction.snapshot && typeof prediction.snapshot === "object"
      ? (prediction.snapshot as Partial<PredictionSnapshot>)
      : {};
  const snapshotLegs = Array.isArray(snapshot.legs) ? snapshot.legs : [];

  const legs = prediction.legs.map((leg, index) => {
    const captured = snapshotLegs[index];
    const fixture = getFixture(leg.fixtureId);
    return {
      id: leg.id,
      fixtureId: leg.fixtureId,
      fixtureLabel:
        captured?.fixtureLabel ??
        (fixture ? `${fixture.homeTeamName} – ${fixture.awayTeamName}` : "Partita non più disponibile"),
      competitionName: captured?.competitionName ?? fixture?.competitionName ?? "—",
      kickoff: captured?.kickoff ?? fixture?.kickoffUtc ?? prediction.createdAt,
      marketId: leg.marketId,
      selectionLabel: selectionDisplayName(leg.marketId, leg.selectionId),
      probability: leg.probability,
      actualWon: leg.actualWon,
    };
  });

  return {
    id: prediction.id,
    createdAt: prediction.createdAt,
    status: prediction.status,
    outcome: prediction.outcome,
    modelVersion: prediction.modelVersion,
    dataQuality: prediction.dataQuality,
    isDemo: prediction.isDemo,
    kickoffMin: prediction.kickoffMin,
    canCancel:
      prediction.status === "OPEN" &&
      prediction.kickoffMin !== null &&
      new Date(prediction.kickoffMin).getTime() > now,
    legs,
  };
}

export default async function TrackerPage() {
  const sessionId = await readSessionId();
  const timezone = sessionId ? getPreferences(sessionId).timezone : "Europe/Rome";
  const predictions = sessionId ? listPredictions(sessionId) : [];

  const summary = metricsFor(predictions);
  const userMetrics = {
    evaluation: summary.evaluation,
    open: summary.exclusions.open,
    voided: summary.exclusions.voided,
    unresolvedLegs: summary.exclusions.unresolvedLegs,
  };

  const demoPredictions = listPredictions("demo-seed", true).filter(
    (prediction) => prediction.sessionId === "demo-seed" && prediction.isDemo,
  );
  const demoSummary = metricsFor(demoPredictions);
  const benchmark = {
    evaluation: demoSummary.evaluation,
    open: demoSummary.exclusions.open,
    voided: demoSummary.exclusions.voided,
    unresolvedLegs: demoSummary.exclusions.unresolvedLegs,
  };

  const now = nowMs();
  const mapped = predictions.map((prediction) => mapPrediction(prediction, now));
  const anyDemo = predictions.some((prediction) => prediction.isDemo);

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Tracker"
        title="Calibrazione, non promesse"
        description="Brier score, log loss e calibrazione calcolati solo sulle previsioni risolte. Un campione piccolo non dimostra nulla."
      />

      <div className="mb-5">
        <Alert tone="info" title="Come funziona la risoluzione">
          Una previsione viene risolta solo quando tutte le sue partite sono concluse. Non viene mai
          spostata da “pre-partita” a “live”, e le probabilità salvate non vengono riscritte. Le
          previsioni annullate prima del calcio d&apos;inizio diventano VOID e restano fuori dalle
          metriche.
        </Alert>
      </div>

      {anyDemo ? (
        <div className="mb-5">
          <Alert tone="warn" title="Stai registrando previsioni su dati DEMO">
            Le partite sono sintetiche. Le metriche misurano il funzionamento del metodo, non la qualità
            predittiva su partite reali.
          </Alert>
        </div>
      ) : null}

      <TrackerBoard
        predictions={mapped}
        metrics={userMetrics}
        benchmark={benchmark}
        timezone={timezone}
        isDemo={anyDemo}
      />

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
        <p>
          Il Brier score misura l&apos;errore quadratico delle probabilità; il log loss penalizza
          fortemente le previsioni sicure e sbagliate. Nessuno dei due è un rendimento economico. Anche
          quando sono disponibili quote storiche, il tracker non calcola un ROI: MatchLab non lo inventa.
        </p>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <Target className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <p>
          Le previsioni sono associate a un cookie anonimo e non a un account. Puoi eliminarle tutte
          dalla pagina Impostazioni, senza lasciare dati personali.
        </p>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
