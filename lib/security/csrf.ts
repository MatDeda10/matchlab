import { NextResponse } from "next/server";

/** Difesa CSRF: le mutazioni accettano solo richieste same-origin. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Alcuni client same-origin non inviano Origin: verifica il Referer.
    const referer = request.headers.get("referer");
    if (!referer) return false;
    try {
      return new URL(referer).origin === new URL(request.url).origin;
    } catch {
      return false;
    }
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function csrfFailure(): NextResponse {
  return NextResponse.json(
    { error: "Origine non consentita. Ricaricare la pagina e riprovare." },
    { status: 403 },
  );
}

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}
