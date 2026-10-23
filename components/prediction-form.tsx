"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Target } from "lucide-react";
import { useToast } from "./toast";

export interface PredictionOption {
  marketId: string;
  marketLabel: string;
  selections: Array<{ id: string; label: string; probability: number }>;
}

export function PredictionForm({
  fixtureId,
  fixtureLabel,
  options,
}: {
  fixtureId: string;
  fixtureLabel: string;
  options: PredictionOption[];
}) {
  const [selected, setSelected] = useState<string>(
    options[0]?.selections[0]
      ? `${options[0].marketId}:${options[0].selections[0].id}`
      : "",
  );
  const [pending, setPending] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { push } = useToast();

  const current = options
    .flatMap((option) =>
      option.selections.map((selection) => ({
        ...selection,
        marketId: option.marketId,
        marketLabel: option.marketLabel,
      })),
    )
    .find((option) => `${option.marketId}:${option.id}` === selected);

  async function submit() {
    if (!selected || !current) return;
    setPending(true);
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections: [
            {
              fixtureId,
              marketId: current.marketId,
              selectionId: current.id,
            },
          ],
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? "Registrazione non riuscita.");
      }
      setSavedId(payload.id);
      push("Previsione registrata nel tracker.", "ok");
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setPending(false);
    }
  }

  if (savedId) {
    return (
      <div className="rounded-2xl border border-ok/25 bg-ok/5 p-4">
        <p className="text-sm font-semibold text-ok">Previsione registrata</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          È stata salvata con la probabilità calcolata ora. Potrai annullarla dal tracker finché
          non sarà risolta. Nessuna quota è stata usata.
        </p>
        <Link href="/tracker" className="btn btn-secondary btn-sm mt-3">
          <Target className="size-3.5" aria-hidden /> Apri il tracker
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold">Registra una previsione</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {fixtureLabel} · la probabilità viene ricalcolata dal server al salvataggio. La previsione
        resta modificabile (annullabile) e non genera alcun movimento di denaro.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="prediction-selection">
          Selezione
        </label>
        <select
          id="prediction-selection"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="select"
        >
          {options.map((option) => (
            <optgroup key={option.marketId} label={option.marketLabel}>
              {option.selections.map((selection) => (
                <option
                  key={`${option.marketId}:${selection.id}`}
                  value={`${option.marketId}:${selection.id}`}
                >
                  {selection.label} — {(selection.probability * 100).toFixed(1)}%
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !selected}
          className="btn btn-primary"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Target className="size-4" aria-hidden />
          )}
          Registra
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-faint">
        Salvata in un database locale associato a un cookie anonimo. Nessun account, nessuna email.
        Le previsioni non sono scommesse e non hanno valore monetario.
      </p>
    </div>
  );
}
