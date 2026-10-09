import { HttpError } from "./errors";

export interface BackendConfig {
  baseUrl: string;

  headers: Record<string, string>;

  configured: boolean;

  allowsPath?: (path: string) => boolean;
  allowUserToken?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

export type BackendClient = ReturnType<typeof createBackendClient>;

export function createBackendClient(
  config: BackendConfig,
  fetcher: typeof fetch = fetch,
) {
  return {
    async request<T>(
      path: string,
      options: {
        method?: "GET" | "POST";
        body?: unknown;
        token?: string;
        query?: Record<string, string | number>;

        timeoutMs?: number;
      } = {},
    ): Promise<T> {
      if (!config.baseUrl || !config.configured)
        throw new HttpError(503, "backend_not_configured");
      if (!/^\/[a-z0-9/_-]+$/i.test(path) || path.startsWith("//"))
        throw new HttpError(500, "invalid_backend_path");
      if (config.allowsPath && !config.allowsPath(path))
        throw new HttpError(500, "invalid_backend_path");
      if (options.token && config.allowUserToken === false)
        throw new HttpError(500, "invalid_backend_credentials");
      let base: URL;
      try {
        base = new URL(config.baseUrl);
      } catch {
        throw new HttpError(503, "invalid_backend_url");
      }
      if (
        !["https:", "http:"].includes(base.protocol) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash
      )
        throw new HttpError(503, "invalid_backend_url");
      const headers = new Headers({
        Accept: "application/json",
        ...config.headers,
      });
      if (options.token)
        headers.set("Authorization", `Bearer ${options.token}`);
      if (options.body !== undefined)
        headers.set("Content-Type", "application/json");
      let response: Response;
      try {
        const target = new URL(`${base.href.replace(/\/$/, "")}${path}`);
        for (const [key, value] of Object.entries(options.query ?? {}))
          target.searchParams.set(key, String(value));
        response = await fetcher(target.href, {
          method: options.method ?? "GET",
          headers,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
          redirect: "error",
          cache: "no-store",
        });
      } catch {
        throw new HttpError(502, "backend_unavailable");
      }
      // Do not reflect upstream messages, HTML exception pages or secrets to visitors.
      if (!response.ok) {
        const transportErrors = new Set([
          "unsupported_coverage",
          "unsupported_capability",
          "sources_unavailable",
          "source_unavailable",
          "stale_location",
          "nearby_stop_not_found",
          "invalid_query",
          "invalid_date",
          "invalid_place",
          "expired_journey",
          "stale_resource",
          "not_found",
        ]);
        if (path.startsWith("/transport/v1/")) {
          const payload = await response
            .clone()
            .json()
            .catch(() => null);
          const code = payload?.errors?.code;
          if (typeof code === "string" && transportErrors.has(code))
            throw new HttpError(
              [404, 409, 422, 429, 503].includes(response.status)
                ? response.status
                : 502,
              code,
              response.status === 429
                ? (response.headers.get("Retry-After") ?? "60")
                : undefined,
            );
        }
        const status = [401, 403, 404, 409, 422, 429].includes(response.status)
          ? response.status
          : 502;
        throw new HttpError(
          status,
          status === 401
            ? "unauthorized"
            : status === 429
              ? "rate_limited"
              : "backend_error",
          status === 429
            ? (response.headers.get("Retry-After") ?? "60")
            : undefined,
        );
      }
      let payload: Envelope<T>;
      try {
        payload = await response.json();
      } catch {
        throw new HttpError(502, "invalid_backend_response");
      }
      if (!payload || payload.success !== true || !("data" in payload))
        throw new HttpError(502, "invalid_backend_response");
      return payload.data;
    },
  };
}
