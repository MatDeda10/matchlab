import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/api/guard";
import { jsonError } from "@/lib/security/csrf";
import { syncProviderData } from "@/lib/services/sync";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  daysBack: z.number().int().min(0).max(120).optional(),
  daysForward: z.number().int().min(0).max(60).optional(),
});

/** Sincronizzazione manuale: utile in sviluppo e nelle deployment con cron. */
export async function POST(request: Request) {
  const guard = await guardMutation(request, {
    limit: 3,
    windowSeconds: 300,
    schema,
  });
  if (!guard.ok) return guard.response;
  const body = guard.body as { daysBack?: number; daysForward?: number };

  try {
    const result = await syncProviderData(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("DEMO") ? 409 : 502;
    console.error("[sync]", error);
    return jsonError(message, status);
  }
}
