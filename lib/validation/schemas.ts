import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida (formato atteso YYYY-MM-DD).");

export const marketIdSchema = z.enum(["1X2", "DC", "OU25", "OU15", "BTTS"]);
export const riskProfileSchema = z.enum(["prudent", "balanced", "aggressive"]);

export const generatorConfigSchema = z
  .object({
    dateFrom: isoDate,
    dateTo: isoDate,
    competitionIds: z.array(z.string().min(1).max(80)).max(12),
    budget: z.number().min(0).max(1_000_000).nullable(),
    events: z.number().int().min(1).max(6),
    profile: riskProfileSchema,
    markets: z.array(marketIdSchema).min(1).max(5),
    maxPerCompetition: z.number().int().min(1).max(4).nullable(),
    minDataQuality: z.number().int().min(0).max(100).nullable(),
    notes: z.string().max(400).optional(),
  })
  .refine((value) => value.dateFrom <= value.dateTo, {
    message: "La data iniziale deve precedere quella finale.",
    path: ["dateTo"],
  })
  .refine((value) => value.events <= value.markets.length * 4, {
    message: "Troppe leg richieste per i mercati selezionati.",
    path: ["events"],
  });

export type GeneratorConfigInput = z.infer<typeof generatorConfigSchema>;

export const saveScenarioSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio.").max(80),
  config: generatorConfigSchema,
});

export const predictionSelectionSchema = z.object({
  fixtureId: z.string().min(1).max(120),
  marketId: marketIdSchema,
  selectionId: z.string().min(1).max(40),
});

export const createPredictionSchema = z.object({
  selections: z.array(predictionSelectionSchema).min(1).max(6),
});

export const preferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  timezone: z.string().min(1).max(64).optional(),
  locale: z.string().min(2).max(16).optional(),
  favoriteCompetitions: z.array(z.string().min(1).max(80)).max(12).optional(),
  defaultProfile: riskProfileSchema.optional(),
  interfacePrefs: z.record(z.string(), z.unknown()).optional(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dati non validi.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
