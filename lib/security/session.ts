import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ml_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function secret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production" && !fromEnv) {
    throw new Error(
      "SESSION_SECRET mancante: impostare una stringa casuale di almeno 32 caratteri in produzione.",
    );
  }
  const file = path.join(process.cwd(), "data", ".session-secret");
  try {
    if (fs.existsSync(file)) {
      const value = fs.readFileSync(file, "utf8").trim();
      if (value.length >= 32) return value;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const generated = randomUUID() + randomUUID();
    fs.writeFileSync(file, generated, { mode: 0o600 });
    return generated;
  } catch {
    // Ultima risorsa per ambienti effimeri di sviluppo.
    return "dev-only-matchlab-secret-change-me-please-32";
  }
}

function sign(sessionId: string): string {
  return createHmac("sha256", secret()).update(sessionId).digest("base64url");
}

export function createSessionValue(): { sessionId: string; value: string } {
  const sessionId = randomUUID();
  return { sessionId, value: `${sessionId}.${sign(sessionId)}` };
}

export function verifySessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const [sessionId, signature] = value.split(".");
  if (!sessionId || !signature) return null;
  const expected = sign(sessionId);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return sessionId;
}

/** Legge la sessione senza crearla (usabile in Server Components). */
export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}

/** Crea/riusa la sessione; usabile solo in Route Handler o Server Action. */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = verifySessionValue(store.get(SESSION_COOKIE)?.value);
  if (existing) return existing;
  const { sessionId, value } = createSessionValue();
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return sessionId;
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
