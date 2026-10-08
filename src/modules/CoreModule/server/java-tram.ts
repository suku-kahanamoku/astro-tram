import { createBackendClient } from "./backend-client";
export interface JavaTramConfig {
  baseUrl: string;
  serviceToken: string;
}
/** Direct server-to-Java transport. No PHP headers or browser-supplied credentials. */
export function createJavaTramClient(
  config: JavaTramConfig,
  fetcher: typeof fetch = fetch,
) {
  return createBackendClient(
    {
      baseUrl: config.baseUrl,
      configured: Boolean(
        config.baseUrl &&
        config.serviceToken.length >= 24 &&
        !/[\r\n]/.test(config.serviceToken),
      ),
      headers: { Authorization: `Bearer ${config.serviceToken}` },
      allowUserToken: false,
      allowsPath: (path) =>
        path.startsWith("/transport/v1/") && !path.includes("/../"),
    },
    fetcher,
  );
}
