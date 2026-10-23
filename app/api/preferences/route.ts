import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { readSessionId } from "@/lib/security/session";
import { getPreferences, savePreferences } from "@/lib/db/repositories";
import { preferencesSchema, type PreferencesInput } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sessionId = await readSessionId();
  if (!sessionId) {
    return NextResponse.json({
      preferences: {
        theme: "dark",
        timezone: "Europe/Rome",
        locale: "it",
        favoriteCompetitions: [],
        defaultProfile: "balanced",
        interfacePrefs: {},
      },
    });
  }
  return NextResponse.json(
    { preferences: getPreferences(sessionId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  const guard = await guardMutation(request, {
    limit: 40,
    windowSeconds: 60,
    schema: preferencesSchema,
  });
  if (!guard.ok) return guard.response;

  try {
    const preferences = savePreferences(guard.sessionId, guard.body as PreferencesInput);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("[preferences]", error);
    return jsonError("Salvataggio delle preferenze non riuscito.", 500);
  }
}
