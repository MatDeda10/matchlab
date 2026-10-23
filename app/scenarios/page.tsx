import { getPreferences, listScenarios } from "@/lib/db/repositories";
import { readSessionId } from "@/lib/security/session";
import { castResult } from "@/lib/services/scenarios";
import type { GeneratorInput } from "@/lib/services/generator";
import { RISK_PROFILES, type MarketId, type RiskProfileId } from "@/lib/config/constants";
import { ScenarioBoard, type ScenarioSummary } from "@/components/scenario-board";
import { Alert, Disclaimer, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

function parseConfig(value: unknown): GeneratorInput | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Partial<GeneratorInput>;
  if (
    typeof config.dateFrom !== "string" ||
    typeof config.dateTo !== "string" ||
    !Array.isArray(config.competitionIds) ||
    !Array.isArray(config.markets) ||
    typeof config.events !== "number" ||
    typeof config.profile !== "string"
  ) {
    return null;
  }
  return config as GeneratorInput;
}

export default async function ScenariosPage() {
  const sessionId = await readSessionId();
  const timezone = sessionId ? getPreferences(sessionId).timezone : "Europe/Rome";
  const scenarios = sessionId ? listScenarios(sessionId) : [];

  const summaries: ScenarioSummary[] = scenarios.map((scenario) => {
    const config = parseConfig(scenario.config);
    const profile: RiskProfileId =
      config && config.profile in RISK_PROFILES ? config.profile : "balanced";
    return {
      id: scenario.id,
      name: scenario.name,
      createdAt: scenario.createdAt,
      isDemo: scenario.isDemo,
      modelVersion: scenario.modelVersion,
      config: {
        dateFrom: config?.dateFrom ?? "—",
        dateTo: config?.dateTo ?? "—",
        competitions: config?.competitionIds.length ?? 0,
        events: config?.events ?? 0,
        profile,
        markets: (config?.markets.filter((market): market is MarketId =>
          ["1X2", "DC", "OU25", "OU15", "BTTS"].includes(market),
        ) ?? []) as MarketId[],
      },
      generation: castResult(scenario),
    };
  });

  return (
    <div className="reveal">
      <PageHeader
        eyebrow="Scenari"
        title="Confronta configurazioni"
        description="Ogni scenario salvato conserva configurazione, probabilità calcolate e incertezza. Il confronto non produce un consiglio."
      />
      <div className="mb-5">
        <Alert tone="info" title="Come leggere il confronto">
          Una probabilità congiunta più alta non significa uno scenario “migliore” in assoluto: dipende
          da quante leg accetti, dalla qualità dei dati e dall&apos;incertezza. Le quote mostrate sono
          contesto di mercato, non un valore atteso calcolato.
        </Alert>
      </div>
      <ScenarioBoard scenarios={summaries} timezone={timezone} />
      <div className="mt-6">
        <Disclaimer compact />
      </div>
    </div>
  );
}
