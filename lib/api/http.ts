export class HttpError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Rate limiter seriale (token bucket semplice, per processo). */
export class RateLimiter {
  private readonly minIntervalMs: number;
  private lastCall = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(requestsPerMinute: number) {
    this.minIntervalMs = Math.ceil(60_000 / Math.max(1, requestsPerMinute));
  }

  acquire(): Promise<void> {
    this.queue = this.queue.then(async () => {
      const wait = Math.max(0, this.lastCall + this.minIntervalMs - Date.now());
      if (wait > 0) await sleep(wait);
      this.lastCall = Date.now();
    });
    return this.queue;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    retries?: number;
    limiter?: RateLimiter;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 12_000;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options.limiter) await options.limiter.acquire();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MatchLab/0.1 (statistical analysis; contact via repository)",
          ...options.headers,
        },
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        throw new HttpError(
          "Rate limit del provider raggiunto",
          429,
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
        );
      }
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new HttpError(
          `HTTP ${response.status} da ${new URL(url).host}: ${body.slice(0, 180)}`,
          response.status,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      const isLast = attempt === retries;
      const retryable =
        error instanceof HttpError
          ? error.status === 429 || error.status >= 500
          : true;
      if (isLast || !retryable) throw error;
      const backoff =
        error instanceof HttpError && error.retryAfterSeconds
          ? error.retryAfterSeconds * 1000
          : Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300;
      await sleep(backoff);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw new Error("Richiesta HTTP fallita dopo i tentativi disponibili");
}
