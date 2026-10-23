"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Layers,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { ProposalLeg } from "@/engine/types";
import type { GeneratorContext, GeneratorInput, GeneratorResponse } from "@/lib/services/generator";
import { ALL_MARKET_IDS, MARKETS, RISK_PROFILES, type MarketId, type RiskProfileId } from "@/lib/config/constants";
import { formatDateTime } from "@/lib/dates";
import { formatPercent, formatScore } from "@/lib/format";
import { useToast } from "./toast";
import {
  Alert,
  Badge,
  Card,
  DemoBadge,
  QualityBadge,
  SectionHeading,
} from "./ui";

export interface GeneratorCompetition {
  id: string;
  name: string;
  country: string;
}

export function GeneratorWizard({
  competitions,
  initialConfig,
  timezone,
  isDemo,
}: {
  competitions: GeneratorCompetition[];
  initialConfig: GeneratorInput;
  timezone: string;
  isDemo: boolean;
}) {
  const [config, setConfig] = useState<GeneratorInput>(initialConfig);
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<GeneratorResponse | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Record<number, string>>({});
  const { push } = useToast();

  const canSubmit = useMemo(
    () =>
      config.competitionIds.length > 0 &&
      config.markets.length > 0 &&
      config.dateFrom <= config.dateTo &&
      !pending,
    [config, pending],
  );

  function patch<K extends keyof GeneratorInput>(key: K, value: GeneratorInput[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function toggleCompetition(id: string) {
    setConfig((current) => ({
      ...current,
      competitionIds: current.competitionIds.includes(id)
        ? current.competitionIds.filter((item) => item !== id)
        : [...current.competitionIds, id],
    }));
  }

  function toggleMarket(id: MarketId) {
    setConfig((current) => ({
      ...current,
      markets: current.markets.includes(id)
        ? current.markets.filter((item) => item !== id)
        : [...current.markets, id],
    }));
  }

  async function generate() {
    setPending(true);
    setSavedIds({});
    try {
      const result = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const payload = (await result.json()) as GeneratorResponse & { error?: string };
      if (!result.ok) throw new Error(payload.error ?? "Generazione non riuscita.");
      setResponse(payload);
      setScenarioName(defaultScenarioName(payload));
      if (payload.result.status === "INSUFFICIENT") {
        push("Nessuno scenario sopra le soglie: guarda i motivi.", "warn");
      } else {
        push(`${payload.result.proposals.length} scenari generati.`, "ok");
      }
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setPending(false);
    }
  }

  async function saveScenario(index: number) {
    if (!response) return;
    const proposal = response.result.proposals[index];
    if (!proposal) return;
    setSavingIndex(index);
    try {
      const result = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: scenarioName.trim() || defaultScenarioName(response),
          config,
        }),
      });
      const payload = (await result.json()) as {
        scenario?: { id: string };
        error?: string;
      };
      if (!result.ok || !payload.scenario) {
        throw new Error(payload.error ?? "Salvataggio non riuscito.");
      }
      setSavedIds((current) => ({ ...current, [index]: payload.scenario!.id }));
      push("Scenario salvato. Puoi confrontarlo nella pagina Scenari.", "ok");
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <SectionHeading
          title="Configurazione"
          description="Il generatore usa probabilità calcolate dal server. Le quote, quando disponibili, sono mostrate come contesto di mercato: non modificano le stime."
          action={isDemo ? <DemoBadge /> : null}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="date-from">Dal</label>
            <input
              id="date-from"
              type="date"
              className="input"
              value={config.dateFrom}
              max={config.dateTo}
              onChange={(event) => patch("dateFrom", event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="date-to">Al</label>
            <input
              id="date-to"
              type="date"
              className="input"
              value={config.dateTo}
              min={config.dateFrom}
              onChange={(event) => patch("dateTo", event.target.value)}
            />
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="label">Competizioni</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {competitions.map((competition) => (
              <label
                key={competition.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface2/30 px-2.5 py-2 text-xs hover:border-line-strong"
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={config.competitionIds.includes(competition.id)}
                  onChange={() => toggleCompetition(competition.id)}
                />
                <span className="min-w-0 flex-1 truncate">{competition.name}</span>
                <span className="text-[10px] text-faint">{competition.country}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="label">Mercati</legend>
          <div className="flex flex-wrap gap-1.5">
            {ALL_MARKET_IDS.map((marketId) => {
              const active = config.markets.includes(marketId);
              return (
                <button
                  key={marketId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleMarket(marketId)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-accent/40 bg-accent/12 text-accent-text"
                      : "border-line bg-surface2/40 text-muted hover:text-fg"
                  }`}
                >
                  {MARKETS[marketId].label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
            Una sola leg per partita. Le probabilità congiunte assumono indipendenza condizionata tra
            partite diverse: è un&apos;assunzione, non un fatto.
          </p>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="label">Profilo di selezione</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(RISK_PROFILES) as RiskProfileId[]).map((profileId) => {
              const profile = RISK_PROFILES[profileId];
              const active = config.profile === profileId;
              return (
                <button
                  key={profileId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch("profile", profileId)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-accent/50 bg-accent/8"
                      : "border-line bg-surface2/30 hover:border-line-strong"
                  }`}
                >
                  <p className="text-xs font-semibold">{profile.label}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted">{profile.description}</p>
                  <p className="mt-1.5 text-[10px] text-faint">
                    Soglia leg {(profile.minLegProbability * 100).toFixed(0)}% · qualità ≥{" "}
                    {profile.minDataQuality}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="events">
              Numero di partite nello scenario: <span className="tnum">{config.events}</span>
            </label>
            <input
              id="events"
              type="range"
              min={1}
              max={6}
              step={1}
              value={config.events}
              onChange={(event) => patch("events", Number(event.target.value))}
              className="range"
            />
            <p className="mt-1 text-[10px] text-faint">
              Più partite = probabilità congiunta più bassa. Non è un moltiplicatore di rendimento.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="budget">
              Budget di riferimento (opzionale, sola visualizzazione)
            </label>
            <input
              id="budget"
              type="number"
              min={0}
              step="0.5"
              placeholder="es. 10"
              className="input"
              value={config.budget ?? ""}
              onChange={(event) =>
                patch("budget", event.target.value === "" ? null : Number(event.target.value))
              }
            />
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              Il budget non modifica le probabilità e non viene usato per suggerire puntate. MatchLab
              non gestisce denaro.
            </p>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-line bg-surface2/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            Vincoli avanzati (opzionali)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="min-quality">Qualità minima del dato (0–100)</label>
              <input
                id="min-quality"
                type="number"
                min={0}
                max={100}
                placeholder={`default profilo: ${RISK_PROFILES[config.profile].minDataQuality}`}
                className="input"
                value={config.minDataQuality ?? ""}
                onChange={(event) =>
                  patch(
                    "minDataQuality",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
              />
            </div>
            <div>
              <label className="label" htmlFor="max-per-competition">Massimo leg per competizione</label>
              <input
                id="max-per-competition"
                type="number"
                min={1}
                max={4}
                placeholder={`default profilo: ${RISK_PROFILES[config.profile].maxLegsPerCompetition}`}
                className="input"
                value={config.maxPerCompetition ?? ""}
                onChange={(event) =>
                  patch(
                    "maxPerCompetition",
                    event.target.value === "" ? null : Number(event.target.value),
                  )
                }
              />
            </div>
          </div>
        </details>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-relaxed text-faint">
            Le soglie non vengono abbassate automaticamente se non esce nulla.
          </p>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={!canSubmit}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {pending ? "Calcolo in corso…" : "Genera scenari"}
          </button>
        </div>
      </Card>

      {response ? (
        <div className="space-y-4">
          <ContextBanner context={response.context} />
          {response.result.status === "INSUFFICIENT" ? (
            <Alert tone="warn" title="Nessuno scenario generato">
              <p>{response.result.message}</p>
              {response.result.excluded.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium">
                    Partite escluse ({response.result.excluded.length})
                  </summary>
                  <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[11px]">
                    {response.result.excluded.slice(0, 40).map((item) => (
                      <li key={`${item.fixtureId}-${item.reason}`}>
                        <span className="font-medium">{item.fixtureLabel}</span> — {item.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </Alert>
          ) : (
            <>
              <div className="rounded-2xl border border-line bg-surface2/30 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="eyebrow">Salva il risultato</p>
                    <p className="mt-1 text-xs text-muted">
                      Salva la configurazione e il risultato per confrontarlo con altri scenari.
                    </p>
                  </div>
                  <input
                    className="input sm:max-w-xs"
                    value={scenarioName}
                    onChange={(event) => setScenarioName(event.target.value)}
                    maxLength={80}
                    aria-label="Nome dello scenario"
                    placeholder="Nome dello scenario"
                  />
                </div>
              </div>

              {response.result.proposals.map((proposal, index) => (
                <Card key={proposal.id} className="overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="accent">Scenario {index + 1}</Badge>
                        <Badge tone="neutral">{proposal.legs.length} leg</Badge>
                        <QualityBadge score={Math.round(proposal.averageQuality)} />
                        {response.context.isDemo ? <DemoBadge /> : null}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">{proposal.rationale}</p>
                    </div>
                    <div className="shrink-0 rounded-xl bg-surface2/60 px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-faint">
                        Probabilità congiunta
                      </p>
                      <p className="tnum text-2xl font-semibold">
                        {formatPercent(proposal.jointProbability)}
                      </p>
                      <p className="text-[10px] text-faint">
                        spread incertezza ±{formatScore(proposal.uncertaintySpread * 100, 1)}%
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-line">
                    {proposal.legs.map((leg) => (
                      <LegRow key={`${leg.fixtureId}-${leg.marketId}-${leg.selectionId}`} leg={leg} timezone={timezone} />
                    ))}
                  </ul>

                  <div className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] leading-relaxed text-faint">
                      {proposal.jointAssumption} Il punteggio di ranking combina probabilità, qualità e
                      incertezza: non è un rendimento atteso.
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {savedIds[index] ? (
                        <Link href="/scenarios" className="btn btn-secondary btn-sm">
                          <Layers className="size-3.5" aria-hidden /> Vai agli scenari
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => saveScenario(index)}
                          disabled={savingIndex !== null}
                        >
                          {savingIndex === index ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Save className="size-3.5" aria-hidden />
                          )}
                          Salva scenario
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          <Card className="p-4">
            <SectionHeading title="Perché questi scenari" />
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted">
              {response.result.assumptions.map((assumption) => (
                <li key={assumption}>· {assumption}</li>
              ))}
              <li>· Candidati valutati: {response.result.candidatesEvaluated}.</li>
              <li>· Modello: {response.result.modelVersions.join(", ") || "n/d"}.</li>
            </ul>
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <TrendingUp className="size-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-semibold">Nessun risultato ancora</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Configura i filtri e genera. Se le soglie sono troppo alte, MatchLab te lo dirà invece di
              abbassarle in silenzio.
            </p>
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-warn/20 bg-warn/5 p-3 text-[10px] leading-relaxed text-warn">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>
          Questi scenari non sono raccomandazioni di scommessa. Le quote mostrate sono pre-partita o di
          chiusura, non live, e provengono dalla fonte indicata: non calcoliamo ROI, valore atteso o
          convenienza. Non aumentare le puntate dopo una perdita.
        </p>
      </div>
    </div>
  );
}

function defaultScenarioName(response: GeneratorResponse): string {
  return `${response.context.dateFrom} · ${response.context.profileLabel} · ${response.result.proposals.length} scenari`;
}

function ContextBanner({ context }: { context: GeneratorContext }) {
  return (
    <div className="rounded-2xl border border-line bg-surface2/30 p-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <Badge tone="neutral">
          <CalendarDays className="size-3" aria-hidden />
          {context.dateFrom} → {context.dateTo}
        </Badge>
        <Badge tone="neutral">{context.fixturesFound} partite nel periodo</Badge>
        <Badge tone="neutral">{context.fixturesEvaluated} valutate</Badge>
        {context.oddsEnabled ? (
          <Badge tone={context.fixturesWithOdds > 0 ? "ok" : "warn"}>
            Quote: {context.fixturesWithOdds}/{context.fixturesFound}
          </Badge>
        ) : (
          <Badge tone="neutral">Quote non disponibili</Badge>
        )}
        <Badge tone="neutral">{context.profileLabel}</Badge>
        {context.isDemo ? <DemoBadge /> : null}
        <span className="text-faint">
          {context.competitionNames.length > 0 ? context.competitionNames.join(" · ") : "Tutte le competizioni"}
        </span>
      </div>
      {context.warnings.length > 0 ? (
        <p className="mt-2 text-[10px] leading-relaxed text-warn">
          {context.warnings.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function LegRow({ leg, timezone }: { leg: ProposalLeg; timezone: string }) {
  return (
    <li className="p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{leg.fixtureLabel}</p>
          <p className="text-[10px] text-faint">
            {formatDateTime(leg.kickoff, timezone)} · {MARKETS[leg.marketId]?.short ?? leg.marketId} ·{" "}
            {leg.selectionLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {leg.market ? (
            <div className="rounded-xl border border-ok/25 bg-ok/5 px-2.5 py-1.5 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-ok">
                Quota migliore
              </p>
              <p className="tnum text-sm font-semibold text-ok">
                {leg.market.odds.toFixed(2)} · {leg.market.bookmakerLabel}
              </p>
              <p className="text-[9px] text-faint">
                implicita {formatPercent(leg.market.impliedProbability)} ·{" "}
                {leg.market.closing ? "chiusura" : "pre-partita"}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface2/40 px-2.5 py-1.5 text-right">
              <p className="text-[9px] font-medium uppercase tracking-wide text-faint">Quota</p>
              <p className="text-[11px] font-medium text-muted">Non disponibile</p>
              <p className="text-[9px] text-faint">nessun dato inventato</p>
            </div>
          )}
          <div className="text-right">
            <p className="tnum text-sm font-semibold">{formatPercent(leg.probability)}</p>
            <p className="text-[10px] text-faint">
              {leg.uncertainty ? `p10 ${formatPercent(leg.uncertainty.p10)} · p90 ${formatPercent(leg.uncertainty.p90)}` : "intervallo n/d"}
            </p>
          </div>
          <Badge tone={leg.qualityScore >= 70 ? "ok" : leg.qualityScore >= 45 ? "warn" : "danger"}>
            {leg.qualityScore}/100
          </Badge>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{leg.rationale}</p>
      {leg.alternatives.length > 0 ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[10px] font-medium text-accent-text">
            Alternative considerate
          </summary>
          <ul className="mt-1 space-y-0.5 text-[10px] text-muted">
            {leg.alternatives.map((alternative) => (
              <li key={alternative.selectionId} className="flex items-center justify-between gap-2">
                <span>{alternative.label}</span>
                <span className="tnum">
                  {formatPercent(alternative.probability)} · Δ congiunta{" "}
                  {alternative.deltaJoint >= 0 ? "+" : ""}
                  {formatScore(alternative.deltaJoint * 100, 1)}%
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
