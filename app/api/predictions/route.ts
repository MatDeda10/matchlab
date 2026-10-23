import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { readSessionId } from "@/lib/security/session";
import { listPredictions } from "@/lib/db/repositories";
import {
  createPredictionFromSelections,
  SelectionError,
  type SelectionInput,
} from "@/lib/services/predictions";
import { createPredictionSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) return NextResponse.json({ predictions: [] });
  return NextResponse.json(
    { predictions: listPredictions(sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await guardMutation(request, {
    limit: 30,
    windowSeconds: 60,
    schema: createPredictionSchema,
  });
  if (!guard.ok) return guard.response;
  const body = guard.body as { selections: SelectionInput[] };

  try {
    const created = createPredictionFromSelections(guard.sessionId, body.selections);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof SelectionError) {
      return jsonError(error.message, error.status);
    }
    console.error("[predictions]", error);
    return jsonError("Registrazione della previsione non riuscita.", 500);
  }
}
