import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { settleFinishedPredictions } from "@/lib/services/predictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Risolve le previsioni le cui partite sono concluse.
 * Non cancella né modifica le probabilità salvate: aggiunge solo l'esito.
 */
export async function POST(request: Request) {
  const guard = await guardMutation(request, { limit: 10, windowSeconds: 60 });
  if (!guard.ok) return guard.response;

  try {
    const settled = settleFinishedPredictions(guard.sessionId);
    return NextResponse.json({ settled });
  } catch (error) {
    console.error("[predictions/settle]", error);
    return jsonError("Risoluzione non riuscita.", 500);
  }
}
