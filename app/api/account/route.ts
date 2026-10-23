import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/security/csrf";
import { readSessionId, SESSION_COOKIE } from "@/lib/security/session";
import { deleteUserData } from "@/lib/db/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Elimina i dati associati alla sessione anonima corrente. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Origine non consentita.", 403);
  const sessionId = await readSessionId();
  if (!sessionId) return NextResponse.json({ ok: true, deleted: false });

  deleteUserData(sessionId);
  const response = NextResponse.json({ ok: true, deleted: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
