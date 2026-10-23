import { AlertTriangle, Sparkles } from "lucide-react";
import { getDataSource } from "@/lib/api";
import { listCompetitions, getPreferences } from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import { defaultGeneratorWindow } from "@/lib/services/model";
import type { GeneratorInput } from "@/lib/services/generator";
import { GeneratorWizard } from "@/components/generator-wizard";
import { Alert, Disclaimer, PageHeader } from "@/components/ui";
import { MODEL, RISK_PROFILES } from "@/lib/config/constants";

export const dynamic = "force-dynamic";

export default async function GeneratorPage() {
  const sessionId = await readSessionId();
  const preferences = sessionId ? getPreferences(sessionId) : null;
  const competitions = listCompetitions().map((competition) => ({
    id: competition.id,
    name: competition.name,
    country: competition.country,
  }));
  const window = defaultGeneratorWindow();
  const defaultProfile =
    preferences && preferences.defaultProfile in RISK_PROFILES
      ? (preferences.defaultProfile as keyof typeof RISK_PROFILES)
      : "balanced";

  const initialConfig: GeneratorInput = {
    dateFrom: window.from,
    dateTo: window.to,
    competitionIds: competitions.map((competition) => competition.id),
    budget: null,
    events: 2,
    profile: defaultProfile,
    markets: ["1X2", "OU25", "BTTS", "DC"],
    maxPerCompetition: null,
    minDataQuality: null,
    notes: "",
  };

  const source = getDataSource();

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Generatore"
        title="Scenari, non scommesse"
        description="Seleziona un periodo, i mercati e un profilo di rischio. Il motore calcola le probabilità e propone combinazioni entro vincoli espliciti."
      />

      <div className="mb-5">
        <Alert tone="warn" title="Cosa non fa il generatore">
          <ul className="list-disc space-y-1 pl-4">
            <li>Non usa quote e non calcola valore atteso, ROI o profitti.</li>
            <li>Non abbassa le soglie per produrre uno scenario a tutti i costi.</li>
            <li>Non gestisce denaro, depositi o puntate reali.</li>
          </ul>
        </Alert>
      </div>

      {source.warnings.length > 0 ? (
        <div className="mb-4">
          <Alert tone="warn" title="Configurazione della fonte">
            {source.warnings.join(" ")}
          </Alert>
        </div>
      ) : null}

      <GeneratorWizard
        competitions={competitions}
        initialConfig={initialConfig}
        timezone={preferences?.timezone ?? "Europe/Rome"}
        isDemo={source.isDemo}
      />

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
        <p>
          Motore deterministico {MODEL.label} v{MODEL.version}. Intervalli p10–p90 da{" "}
          {MODEL.uncertaintyIterations} simulazioni di sensibilità. Le probabilità non sono garanzie e
          il punteggio di ranking non è un rendimento atteso.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface2/20 p-3 text-[10px] leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
        <p>
          Un profilo “Alto” accetta soglie più basse e maggiore incertezza: non significa maggiore
          valore atteso né maggiore probabilità di profitto. Non inseguire le perdite.
        </p>
      </div>

      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
