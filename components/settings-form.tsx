"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { RISK_PROFILES, type RiskProfileId } from "@/lib/config/constants";
import { useToast } from "./toast";
import { Card, SectionHeading } from "./ui";

export interface SettingsCompetition {
  id: string;
  name: string;
  country: string;
}

export function SettingsForm({
  competitions,
  initial,
}: {
  competitions: SettingsCompetition[];
  initial: {
    timezone: string;
    defaultProfile: RiskProfileId;
    favoriteCompetitions: string[];
  };
}) {
  const [timezone, setTimezone] = useState(initial.timezone);
  const [defaultProfile, setDefaultProfile] = useState<RiskProfileId>(initial.defaultProfile);
  const [favorites, setFavorites] = useState<string[]>(initial.favoriteCompetitions);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          defaultProfile,
          favoriteCompetitions: favorites,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Salvataggio non riuscito.");
      push("Preferenze salvate.", "ok");
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <SectionHeading
        title="Preferenze"
        description="Salvate nel database insieme alla sessione anonima. Il tema resta anche in localStorage."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="timezone">Fuso orario</label>
          <select
            id="timezone"
            className="select"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {[
              ["Europe/Rome", "Roma (Europe/Rome)"],
              ["Europe/London", "Londra (Europe/London)"],
              ["Europe/Madrid", "Madrid (Europe/Madrid)"],
              ["Europe/Berlin", "Berlino (Europe/Berlin)"],
              ["UTC", "UTC"],
              ["America/New_York", "New York (America/New_York)"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-faint">
            Gli orari sono salvati in UTC e convertiti solo per la visualizzazione.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="profile">Profilo predefinito del generatore</label>
          <select
            id="profile"
            className="select"
            value={defaultProfile}
            onChange={(event) => setDefaultProfile(event.target.value as RiskProfileId)}
          >
            {(Object.keys(RISK_PROFILES) as RiskProfileId[]).map((id) => (
              <option key={id} value={id}>
                {RISK_PROFILES[id].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-faint">
            Cambia solo i criteri di selezione, non le probabilità.
          </p>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="label">Competizioni preferite</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {competitions.map((competition) => (
            <label
              key={competition.id}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface2/30 px-2.5 py-2 text-xs"
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={favorites.includes(competition.id)}
                onChange={() => toggleFavorite(competition.id)}
              />
              <span className="min-w-0 flex-1 truncate">{competition.name}</span>
              <span className="text-[10px] text-faint">{competition.country}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex justify-end">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Save className="size-3.5" aria-hidden />
          )}
          Salva preferenze
        </button>
      </div>
    </Card>
  );
}

export function DeleteDataCard() {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  async function remove() {
    setPending(true);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Eliminazione non riuscita.");
      push("Dati eliminati. La sessione è stata chiusa.", "ok");
      setConfirmation("");
      router.refresh();
      router.push("/");
    } catch (error) {
      push((error as Error).message, "warn");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-danger/25 p-4">
      <SectionHeading
        title="Elimina i tuoi dati"
        description="Rimuove previsioni, scenari e preferenze associate a questa sessione anonima. L'operazione non è reversibile."
      />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label" htmlFor="delete-confirmation">
            Scrivi ELIMINA per confermare
          </label>
          <input
            id="delete-confirmation"
            className="input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="btn btn-danger self-end"
          disabled={confirmation !== "ELIMINA" || pending}
          onClick={remove}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
          Elimina tutto
        </button>
      </div>
    </Card>
  );
}
