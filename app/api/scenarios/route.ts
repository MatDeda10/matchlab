import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { readSessionId } from "@/lib/security/session";
import { getScenarios, saveScenario } from "@/lib/services/scenarios";
import { saveScenarioSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) return NextResponse.json({ scenarios: [] });
  return NextResponse.json(
    { scenarios: getScenarios(sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const guard = await guardMutation(request, {
    limit: 20,
    windowSeconds: 60,
    schema: saveScenarioSchema,
  });
  if (!guard.ok) return guard.response;
  const input = guard.body as { name: string; config: Parameters<typeof saveScenario>[1]["config"] };

  try {
    const saved = saveScenario(guard.sessionId, input);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("[scenarios]", error);
    return jsonError("Salvataggio dello scenario non riuscito.", 500);
  }
}
