import { get, run } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

/**
 * Fixed window persistito su SQLite: funziona anche tra richieste diverse
 * e processi concorrenti. Non usa IP (nessun dato personale).
 */
export function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const row = get<{ window_start: number; count: number; limit_value: number }>(
    "SELECT window_start, count, limit_value FROM rate_limits WHERE bucket = ?",
    bucket,
  );

  if (!row || row.window_start !== windowStart) {
    run(
      `INSERT INTO rate_limits (bucket, window_start, count, limit_value)
       VALUES (?, ?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, count = 1, limit_value = excluded.limit_value`,
      bucket,
      windowStart,
      limit,
    );
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0, limit };
  }

  if (row.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, windowStart + windowSeconds - Math.floor(now / 1000)),
      limit,
    };
  }

  run("UPDATE rate_limits SET count = count + 1 WHERE bucket = ?", bucket);
  return { allowed: true, remaining: limit - row.count - 1, retryAfterSeconds: 0, limit };
}

/** Body parser con limite esplicito (protezione abuso). */
export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new RequestTooLargeError(maxBytes);
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new RequestTooLargeError(maxBytes);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

export class RequestTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Richiesta troppo grande (massimo ${maxBytes} byte).`);
    this.name = "RequestTooLargeError";
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super("JSON non valido.");
    this.name = "InvalidJsonError";
  }
}
