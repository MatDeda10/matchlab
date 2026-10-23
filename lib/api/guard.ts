import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, InvalidJsonError, readJsonBody, RequestTooLargeError } from "@/lib/security/rate-limit";
import { csrfFailure, isSameOrigin, jsonError } from "@/lib/security/csrf";
import { ensureSessionId } from "@/lib/security/session";
import { firstIssue } from "@/lib/validation/schemas";

export interface GuardOptions {
  limit: number;
  windowSeconds: number;
  schema?: z.ZodType;
}

export type GuardResult =
  | { ok: true; sessionId: string; body: unknown }
  | { ok: false; response: NextResponse };

/**
 * Guardia comune per le route mutabili:
 * same-origin, body limitato, sessione anonima, rate limit per sessione.
 */
export async function guardMutation(
  request: Request,
  options: GuardOptions,
): Promise<GuardResult> {
  if (!isSameOrigin(request)) return { ok: false, response: csrfFailure() };

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return { ok: false, response: jsonError(error.message, 413) };
    }
    if (error instanceof InvalidJsonError) {
      return { ok: false, response: jsonError(error.message, 400) };
    }
    return { ok: false, response: jsonError("Richiesta non leggibile.", 400) };
  }

  if (options.schema) {
    const parsed = options.schema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, response: jsonError(firstIssue(parsed.error), 422) };
    }
    body = parsed.data;
  }

  const sessionId = await ensureSessionId();
  const scope = new URL(request.url).pathname;
  const rate = checkRateLimit(`api:${sessionId}:${scope}`, options.limit, options.windowSeconds);
  if (!rate.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Troppe richieste. Riprova tra ${rate.retryAfterSeconds} secondi.`,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      ),
    };
  }

  return { ok: true, sessionId, body };
}
