"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Loader2, Sparkles, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatPercent, formatScore } from "@/lib/format";
import { MARKETS, RISK_PROFILES, type MarketId, type RiskProfileId } from "@/lib/config/constants";
import type { GeneratorResponse } from "@/lib/services/generator";
import { useToast } from "./toast";
import { Badge, Card, DemoBadge, EmptyState, QualityBadge, SectionHeading } from "./ui";

export interface ScenarioSummary {
  id: string;
  name: string;
  createdAt: string;
  isDemo: boolean;
  modelVersion: string;
  config: {
    dateFrom: string;
    dateTo: string;
    competitions: number;
    events: number;
    profile: RiskProfileId;
    markets: MarketId[];
  };
  generation: GeneratorResponse | null;
}

export function ScenarioBoard({
  scenarios,
  timezone,
}: {
  scenarios: ScenarioSummary[];
  timezone: string;
}) {
  const [selected, setSelected] = useState<string[]>(scenarios.slice(0, 2).map((item) => item.id));
  const [deleting, setDeleting] = useState<string | null>(null);
  const { push } = useToast();
  const router = useRouter();

  const chosen = useMemo(
    () => scenarios.filter((scenario) => selected.includes(scenario.id)),
    [scenarios, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 4) {
        push("Puoi confrontare al massimo 4 scenari.", "warn");
        return current;
      }
      return [...current, id];
    });
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      const response = await fetch(`/api/scenarios/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Eliminazione non riuscita.");
      }
      push("Scenario eliminato.", "ok");
      router.refresh();
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setDeleting(null);
    }
  }

  if (scenarios.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          title="Nessuno scenario salvato"
          description="Genera una configurazione e salvala dal generatore per confrontarla qui. MatchLab non crea scenari finti per riempire la pagina."
          icon={Layers}
          action={
            <Link href="/generator" className="btn btn-primary btn-sm">
              <Sparkles className="size-3.5" aria-hidden /> Apri il generatore
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <SectionHeading
          title="I tuoi scenari"
          description="Seleziona fino a 4 scenari per confrontarli. I dati sono associati a questa sessione anonima."
        />
        <ul className="space-y-2">
          {scenarios.map((scenario) => {
            const active = selected.includes(scenario.id);
            const proposals = scenario.generation?.result.proposals ?? [];
            return (
              <li
                key={scenario.id}
                className={`rounded-xl border p-3 transition-colors ${
                  active ? "border-accent/40 bg-accent/5" : "border-line bg-surface2/20"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={active}
                      onChange={() => toggle(scenario.id)}
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-semibold">{scenario.name}</span>
                        {scenario.isDemo ? <DemoBadge /> : null}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-faint">
                        {formatDateTime(scenario.createdAt, timezone)} ·{" "}
                        {scenario.config.dateFrom} → {scenario.config.dateTo} ·{" "}
                        {RISK_PROFILES[scenario.config.profile]?.label ?? scenario.config.profile} ·{" "}
                        {proposals.length} scenari
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {proposals[0] ? (
                      <span className="chip">
                        migliore <span className="tnum font-semibold">{formatPercent(proposals[0].jointProbability)}</span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => remove(scenario.id)}
                      disabled={deleting === scenario.id}
                      aria-label={`Elimina ${scenario.name}`}
                    >
                      {deleting === scenario.id ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-3.5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {chosen.length === 0 ? (
        <Card className="p-4">
          <p className="text-xs text-muted">Seleziona almeno uno scenario per vedere il confronto.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4">
            <SectionHeading
              title="Confronto"
              description="Nessun punteggio è un rendimento: sono probabilità stimate, qualità del dato e incertezza."
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Voce</th>
                  {chosen.map((scenario) => (
                    <th key={scenario.id} className="text-center">
                      {scenario.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Profilo" values={chosen.map((s) => RISK_PROFILES[s.config.profile]?.label ?? s.config.profile)} />
                <Row label="Periodo" values={chosen.map((s) => `${s.config.dateFrom} → ${s.config.dateTo}`)} />
                <Row label="Mercati" values={chosen.map((s) => s.config.markets.map((m) => MARKETS[m]?.short ?? m).join(", ") || "—")} />
                <Row label="Scenari generati" values={chosen.map((s) => String(s.generation?.result.proposals.length ?? 0))} />
                <Row
                  label="Miglior probabilità congiunta"
                  values={chosen.map((s) => formatPercent(s.generation?.result.proposals[0]?.jointProbability ?? 0))}
                />
                <Row
                  label="Qualità media"
                  values={chosen.map((s) =>
                    s.generation?.result.proposals[0]
                      ? `${Math.round(s.generation.result.proposals[0].averageQuality)}/100`
                      : "—",
                  )}
                />
                <Row
                  label="Incertezza media"
                  values={chosen.map((s) =>
                    s.generation?.result.proposals[0]
                      ? `±${formatScore(s.generation.result.proposals[0].uncertaintySpread * 100, 1)}%`
                      : "—",
                  )}
                />
                <Row
                  label="Leg"
                  values={chosen.map((s) =>
                    s.generation?.result.proposals[0]
                      ? s.generation.result.proposals[0].legs.map((leg) => leg.selectionLabel).join(" · ")
                      : "—",
                  )}
                />
                <Row label="Stato" values={chosen.map((s) => (s.generation?.result.status === "INSUFFICIENT" ? "Nessuno scenario sopra soglia" : "Generato"))} />
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {chosen.map((scenario) => {
          const proposals = scenario.generation?.result.proposals ?? [];
          const best = proposals[0];
          return (
            <Card key={scenario.id} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold">{scenario.name}</p>
                <Badge tone="neutral">{scenario.modelVersion}</Badge>
              </div>
              {!best ? (
                <p className="text-[11px] leading-relaxed text-muted">
                  {scenario.generation?.result.message ?? "Risultato non leggibile per questo scenario."}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <QualityBadge score={Math.round(best.averageQuality)} />
                    <p className="tnum text-lg font-semibold">{formatPercent(best.jointProbability)}</p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {best.legs.map((leg) => (
                      <li key={`${leg.fixtureId}-${leg.selectionId}`} className="rounded-lg bg-surface2/30 p-2">
                        <p className="truncate text-[11px] font-medium">{leg.fixtureLabel}</p>
                        <p className="text-[10px] text-muted">
                          {leg.marketLabel} · {leg.selectionLabel} ·{" "}
                          <span className="tnum font-semibold">{formatPercent(leg.probability)}</span>
                        </p>
                        {leg.market ? (
                          <p className="mt-0.5 text-[9px] text-ok">
                            Quota migliore {leg.market.odds.toFixed(2)} · {leg.market.bookmakerLabel} ·{" "}
                            {leg.market.closing ? "chiusura" : "pre-partita"}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[9px] text-faint">Quota non disponibile</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] leading-relaxed text-faint">{best.jointAssumption}</p>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, values }: { label: string; values: string[] }) {
  return (
    <tr>
      <td className="text-muted">{label}</td>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="text-center text-[11px]">
          {value}
        </td>
      ))}
    </tr>
  );
}
