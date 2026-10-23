import { createScenario, getScenariosByIds, listScenarios, deleteScenario } from "@/lib/db/repositories";
import type { ScenarioDto } from "@/lib/db/types";
import { runGeneration, type GeneratorInput, type GeneratorResponse } from "./generator";

export interface SaveScenarioInput {
  name: string;
  config: GeneratorInput;
}

export function saveScenario(
  sessionId: string,
  input: SaveScenarioInput,
): { scenario: ScenarioDto; generation: GeneratorResponse } {
  const generation = runGeneration(input.config);
  const id = createScenario({
    sessionId,
    name: input.name,
    modelVersion: generation.result.modelVersions[0] ?? "unknown",
    config: input.config,
    result: generation,
    isDemo: generation.context.isDemo,
  });
  const scenario = getScenariosByIds(sessionId, [id])[0];
  if (!scenario) throw new Error("Scenario salvato ma non rileggibile.");
  return { scenario, generation };
}

export function getScenarios(sessionId: string, ids: string[] = []): ScenarioDto[] {
  if (ids.length > 0) return getScenariosByIds(sessionId, ids.slice(0, 4));
  return listScenarios(sessionId);
}

export function removeScenario(id: string, sessionId: string): boolean {
  return deleteScenario(id, sessionId);
}

export function castResult(scenario: ScenarioDto): GeneratorResponse | null {
  const value = scenario.result;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GeneratorResponse>;
  if (!candidate.result || !candidate.context) return null;
  return candidate as GeneratorResponse;
}
