import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security/csrf";
import { jsonError } from "@/lib/security/csrf";
import { readSessionId } from "@/lib/security/session";
import { removeScenario } from "@/lib/services/scenarios";

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
  const removed = removeScenario(id, sessionId);
  if (!removed) return jsonError("Scenario non trovato.", 404);
  return NextResponse.json({ ok: true });
}
