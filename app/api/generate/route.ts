import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { runGeneration } from "@/lib/services/generator";
import { generatorConfigSchema, type GeneratorConfigInput } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guard = await guardMutation(request, {
    limit: 12,
    windowSeconds: 60,
    schema: generatorConfigSchema,
  });
  if (!guard.ok) return guard.response;
  const config = guard.body as GeneratorConfigInput;

  try {
    const generation = runGeneration(config);
    return NextResponse.json(generation, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[generate]", error);
    return jsonError(
      "Generazione non riuscita. Verifica il database e riprova.",
      500,
    );
  }
}
