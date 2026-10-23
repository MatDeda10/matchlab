import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/security/csrf";
import { readSessionId } from "@/lib/security/session";
import { cancelPrediction } from "@/lib/db/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Origine non consentita.", 403);
  const sessionId = await readSessionId();
  if (!sessionId) return jsonError("Nessuna sessione attiva.", 401);
  const { id } = await params;

  const cancelled = cancelPrediction(id, sessionId);
  if (!cancelled) {
    return jsonError(
      "Previsione non annullabile: non esiste, è già risolta oppure la partita è iniziata.",
      409,
    );
  }
  return NextResponse.json({ ok: true });
}
