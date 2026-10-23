"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, Target, X } from "lucide-react";
import type { EvaluationResult } from "@/engine/evaluation";
import { formatDateTime } from "@/lib/dates";
import { formatPercent, formatSigned } from "@/lib/format";
import { CalibrationChart } from "./charts";
import { useToast } from "./toast";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  SectionHeading,
  Stat,
} from "./ui";

export interface TrackerLeg {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  competitionName: string;
  kickoff: string;
  marketId: string;
  selectionLabel: string;
  probability: number;
  actualWon: boolean | null;
}

export interface TrackerPrediction {
  id: string;
  createdAt: string;
  status: "OPEN" | "SETTLED" | "VOID";
  outcome: "WON" | "LOST" | "VOID" | null;
  modelVersion: string;
  dataQuality: number;
  isDemo: boolean;
  kickoffMin: string | null;
  canCancel: boolean;
  legs: TrackerLeg[];
}

export interface TrackerMetrics {
  evaluation: EvaluationResult;
  open: number;
  voided: number;
  unresolvedLegs: number;
}

export function TrackerBoard({
  predictions,
  metrics,
  benchmark,
  timezone,
  isDemo,
}: {
  predictions: TrackerPrediction[];
  metrics: TrackerMetrics;
  benchmark: TrackerMetrics | null;
  timezone: string;
  isDemo: boolean;
}) {
  const [pending, setPending] = useState<"settle" | string | null>(null);
  const { push } = useToast();
  const router = useRouter();

  async function settle() {
    setPending("settle");
    try {
      const response = await fetch("/api/predictions/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { settled?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Risoluzione non riuscita.");
      push(
        payload.settled
          ? `${payload.settled} previsioni risolte.`
          : "Nessuna partita conclusa da risolvere al momento.",
        "ok",
      );
      router.refresh();
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setPending(null);
    }
  }

  async function cancel(id: string) {
    setPending(id);
    try {
      const response = await fetch(`/api/predictions/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Annullamento non riuscito.");
      push("Previsione annullata (VOID). Non entra nelle metriche.", "ok");
      router.refresh();
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setPending(null);
    }
  }

  const evaluation = metrics.evaluation;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <Stat
            label="Brier (leg binarie)"
            value={evaluation.legs > 0 ? evaluation.brierBinary.toFixed(4) : "—"}
            hint={`${evaluation.legs} leg risolte`}
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Log loss"
            value={evaluation.legs > 0 ? evaluation.logLossBinary.toFixed(4) : "—"}
            hint="più basso è meglio"
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Errore di calibrazione"
            value={evaluation.legs > 0 ? evaluation.calibrationError.toFixed(4) : "—"}
            hint="distanza media previsto/osservato"
          />
        </Card>
        <Card className="p-4">
          <Stat
            label="Previsioni risolte"
            value={String(evaluation.predictions)}
            hint={`${metrics.open} aperte · ${metrics.voided} annullate`}
          />
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-muted">
          Le metriche includono solo previsioni risolte con esito verificabile. Le leg non risolte (
          {metrics.unresolvedLegs}) sono escluse, non contate come vittorie.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0"
          onClick={settle}
          disabled={pending !== null}
        >
          {pending === "settle" ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCheck className="size-3.5" aria-hidden />
          )}
          Risolvi partite concluse
        </button>
      </div>

      {evaluation.sampleWarning ? (
        <Alert tone="warn" title="Campione troppo piccolo">
          Con meno di 30 osservazioni le metriche sono instabili e non dimostrano nulla sulla qualità
          del modello. Servono molti più dati prima di trarre conclusioni.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-4">
          <SectionHeading
            title="Calibrazione"
            description="Probabilità prevista vs frequenza osservata. La diagonale è la calibrazione perfetta."
          />
          {evaluation.legs > 0 ? (
            <CalibrationChart bins={evaluation.calibration} />
          ) : (
            <EmptyState
              title="Nessuna previsione risolta"
              description="Registra una previsione pre-partita e risolvila a partita conclusa: solo allora apparirà qui."
              icon={Target}
            />
          )}
        </Card>

        <Card className="p-4">
          <SectionHeading
            title="Per mercato"
            description="Le metriche aggregate possono nascondere differenze tra mercati."
          />
          {evaluation.byMarket.length === 0 ? (
            <p className="text-xs text-muted">Nessun dato risolto.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mercato</th>
                    <th className="text-center">N</th>
                    <th className="text-center">Brier</th>
                    <th className="text-center">Log loss</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.byMarket.map((row) => (
                    <tr key={row.group}>
                      <td>{row.group}</td>
                      <td className="tnum text-center">{row.count}</td>
                      <td className="tnum text-center">{row.brier.toFixed(3)}</td>
                      <td className="tnum text-center">{row.logLoss.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {benchmark ? (
        <Card className="p-4">
          <SectionHeading
            title="Benchmark dimostrativo (dati sintetici)"
            description="Previsioni generate al seed su partite DEMO concluse. Serve a mostrare il metodo di valutazione, non a dimostrare capacità predittiva."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Brier benchmark" value={benchmark.evaluation.brierBinary.toFixed(4)} hint={`${benchmark.evaluation.legs} leg`} />
            <Stat label="Tuo Brier" value={evaluation.legs > 0 ? evaluation.brierBinary.toFixed(4) : "—"} hint="stesso calcolo" />
            <Stat
              label="Skill score"
              value={
                evaluation.legs > 0 && benchmark.evaluation.legs > 0
                  ? formatSigned(1 - evaluation.brierBinary / benchmark.evaluation.brierBinary, 3)
                  : "—"
              }
              hint="positivo = meglio del benchmark"
            />
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-faint">
            Il benchmark usa dati sintetici e un campione piccolo: non è una baseline reale. Senza quote
            non è comunque possibile calcolare un ROI.
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <SectionHeading
          title="Le tue previsioni"
          description="La probabilità mostrata è quella salvata al momento della registrazione: non viene riscritta."
          action={
            <span className="text-[10px] text-faint">
              {predictions.length} totali {isDemo ? "· dati DEMO" : ""}
            </span>
          }
        />
        {predictions.length === 0 ? (
          <EmptyState
            title="Nessuna previsione registrata"
            description="Apri una partita programmata e usa “Registra una previsione”. Non ci sono previsioni finte create per riempire il tracker."
            icon={Target}
            action={
              <Link href="/matches" className="btn btn-primary btn-sm">
                Sfoglia le partite
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {predictions.map((prediction) => (
              <li key={prediction.id} className="rounded-xl border border-line bg-surface2/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      tone={
                        prediction.status === "OPEN"
                          ? "accent"
                          : prediction.outcome === "WON"
                            ? "ok"
                            : prediction.outcome === "LOST"
                              ? "danger"
                              : "neutral"
                      }
                    >
                      {prediction.status === "OPEN"
                        ? "Aperta"
                        : prediction.outcome === "WON"
                          ? "Vinta"
                          : prediction.outcome === "LOST"
                            ? "Persa"
                            : "Annullata"}
                    </Badge>
                    <span className="text-[10px] text-faint">
                      {formatDateTime(prediction.createdAt, timezone)} · modello {prediction.modelVersion} ·
                      qualità {prediction.dataQuality}/100
                    </span>
                  </div>
                  {prediction.canCancel ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => cancel(prediction.id)}
                      disabled={pending !== null}
                    >
                      {pending === prediction.id ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : (
                        <X className="size-3" aria-hidden />
                      )}
                      Annulla
                    </button>
                  ) : null}
                </div>
                <ul className="mt-2 space-y-1">
                  {prediction.legs.map((leg) => (
                    <li key={leg.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate">
                        <Link href={`/matches/${leg.fixtureId}`} className="hover:underline">
                          {leg.fixtureLabel}
                        </Link>
                        <span className="text-faint"> · {leg.competitionName} · {leg.selectionLabel}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="tnum font-semibold">{formatPercent(leg.probability)}</span>
                        <span
                          className={`flex size-5 items-center justify-center rounded-full text-[9px] font-bold ${
                            leg.actualWon === null
                              ? "bg-surface3 text-faint"
                              : leg.actualWon
                                ? "bg-ok/15 text-ok"
                                : "bg-danger/15 text-danger"
                          }`}
                          title={
                            leg.actualWon === null
                              ? "Non risolta"
                              : leg.actualWon
                                ? "Selezione corretta"
                                : "Selezione errata"
                          }
                        >
                          {leg.actualWon === null ? "·" : leg.actualWon ? "✓" : "✕"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
