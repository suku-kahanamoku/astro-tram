import { HttpError } from "./errors";
import { createHash } from "node:crypto";
const fetchScopes = new WeakMap<typeof fetch, number>();
let nextFetchScope = 0;

/**
 * Konfigurace odchozího HTTP klienta k php-core.
 * Všechny hodnoty pocházejí ze serverového prostředí, ne od klienta.
 */
export interface CoreConfig {
  /** Základní URL php-core, např. `https://php-core.example`; bez koncového lomítka. */
  baseUrl: string;
  /** Interní API klíč, který se posílá v hlavičce `X-Internal-Key`. */
  apiKey: string;
  /** Pevný tenant host, který se posílá v hlavičce `X-Forwarded-Host`. */
  tenantHost: string;
}

/**
 * Obalová struktura, v jaké php-core vrací každou odpověď.
 * Klíč `success` musí být `true` a musí existovat `data`.
 */
interface Envelope<T> {
  success: boolean;
  data: T;
}

/** Odchozí HTTP klient k php-core vytvořený funkcí {@link createCoreClient}. */
export type CoreClient = ReturnType<typeof createCoreClient>;

/**
 * Vytvoří odchozího HTTP klienta k php-core.
 *
 * Instanci vytvořenou per požadavek. Nikdy nepřijímejte od browsera URL, tenanta
 * ani hlavičky: klíč API, pevný tenant a uživatelský patří jen serverové vrstvě.
 *
 * @param config Základní URL, API klíč a tenant host ze serverového prostředí.
 * @param fetcher Implementace `fetch`, defaultně globální; v testech lze podstrčit stub.
 * @returns Objekt s metodou `request<T>`, která volá php-core a vrátí data obálky.
 * @throws HttpError s kódem `backend_not_configured`, pokud chybí část konfigurace.
 */
export function createCoreClient(
  config: CoreConfig,
  fetcher: typeof fetch = fetch,
) {
  // A server-only cache namespace includes credentials and injected transport identity.
  // Hashes and raw credentials never form part of public response data.
  if (!fetchScopes.has(fetcher)) fetchScopes.set(fetcher, ++nextFetchScope);
  const cacheScope = createHash("sha256")
    .update(
      JSON.stringify([
        config.baseUrl,
        config.apiKey,
        config.tenantHost,
        fetchScopes.get(fetcher),
      ]),
    )
    .digest("hex");
  return {
    cacheScope,
    /**
     * Provede jeden požadavek k php-core a vrátí data z obálky odpovědi.
     *
     * @param path Absolutní cesta endpointu, např. `/auth/login`; nesmí obsahovat
     *   dotaz, protokol ani dvojité lomítko.
     * @param options Nepovinné `method` (defaultně `GET`), `body` pro JSON a
     *   `token` uživatelského bearera, který se přidá do `Authorization`.
     * @returns Rozbalený obsah `data` z odpovědi php-core.
     * @throws HttpError při nekonfiguraci klienta (503), neplatné cestě (500),
     *   neplatném tenantu či URL (503), nedostupnosti (502), stavových kódech
     *   mimo povolenou množinu (502) a neplatné odpovědi (502).
     */
    async request<T>(
      path: string,
      options: {
        method?: "GET" | "POST";
        body?: unknown;
        token?: string;
        query?: Record<string, string | number>;
        /** Server-selected deadline; journey search needs time for provider failover. */
        timeoutMs?: number;
      } = {},
    ): Promise<T> {
      if (!config.baseUrl || !config.apiKey || !config.tenantHost)
        throw new HttpError(503, "backend_not_configured");
      if (!/^\/[a-z0-9/_-]+$/i.test(path) || path.startsWith("//"))
        throw new HttpError(500, "invalid_backend_path");
      if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(config.tenantHost))
        throw new HttpError(503, "invalid_tenant_host");
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
        "X-Internal-Key": config.apiKey,
        "X-Forwarded-Host": config.tenantHost,
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
              [404, 422, 429, 503].includes(response.status)
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
