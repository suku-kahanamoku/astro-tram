import { createBackendClient } from "./backend-client";
import { HttpError } from "./errors";
export interface CoreConfig {
  baseUrl: string;
  apiKey: string;
  tenantHost: string;
}
export type CoreClient = ReturnType<typeof createCoreClient>;
/** PHP remains responsible for accounts and authenticated administration. */
export function createCoreClient(
  config: CoreConfig,
  fetcher: typeof fetch = fetch,
) {
  const client = createBackendClient(
    {
      baseUrl: config.baseUrl,
      configured: Boolean(config.baseUrl && config.apiKey && config.tenantHost),
      headers: {
        "X-Internal-Key": config.apiKey,
        "X-Forwarded-Host": config.tenantHost,
      },
    },
    fetcher,
  );
  return {
    ...client,
    request: async <T>(...args: Parameters<typeof client.request<T>>) => {
      if (
        config.tenantHost &&
        !/^[a-z0-9.-]+(?::\d+)?$/i.test(config.tenantHost)
      )
        throw new HttpError(503, "invalid_tenant_host");
      return client.request<T>(...args);
    },
  };
}
