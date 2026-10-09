/** Public API failure; upstream internals stay behind the server boundary. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfterMs?: number,
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function retryAfter(value: string | null): number | undefined {
  if (!value) return;
  const delay = /^\d+$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(1000, delay) : undefined;
}

/** Same-origin, non-persistent JSON transport shared by browser domains. */
export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  if (!path.startsWith("/api/") || /[\\#\r\n]/.test(path))
    throw new Error("Invalid API path");
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body != null && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout,
  });
  // Hosts can return an HTML error page; it is never a usable API envelope.
  const payload: unknown = await response.json().catch(() => null);
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  if (!response.ok || body?.success !== true || !("data" in body))
    throw new ApiError(
      response.status,
      typeof body?.error === "string" ? body.error : "request_failed",
      retryAfter(response.headers.get("Retry-After")),
    );
  return body.data as T;
}

/** JSON serialization for callers that do not need native RequestInit options. */
export function api<T>(
  path: `/api/${string}`,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  return requestJson<T>(path, {
    method: options.method ?? "GET",
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}
