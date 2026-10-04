import {
  PHP_CORE_URL,
  PHP_CORE_API_KEY,
  PHP_CORE_TENANT_HOST,
} from "astro:env/server";
import { createCoreClient } from "../modules/CoreModule/server/php-core";
import { createTransportProvider } from "../modules/TransportModule/server/provider";
import { createAuthProvider } from "../modules/AuthModule/server/provider";
import { createPipelineProvider } from "../modules/SiteModule/server/pipelineProvider";

/**
 * Sestaví poskytovatele serverové vrstvy pro jeden požadavek.
 *
 * Volá se z `src/middleware.ts`, takže každý požadavek dostane vlastní
 * instanci HTTP klienta. Klíč API, pevný tenant host a uživatelský bearer
 * zůstávají výhradně na serveru a nikdy nepřecházejí do klientského kódu.
 *
 * @returns Objekt s providerem `auth` postaveným na CoreModule klientovi.
 */
export function createProviders() {
  const core = createCoreClient({
    baseUrl: PHP_CORE_URL ?? "",
    apiKey: PHP_CORE_API_KEY ?? "",
    tenantHost: PHP_CORE_TENANT_HOST ?? "",
  });
  return {
    auth: createAuthProvider(core),
    transport: createTransportProvider(core),
    pipeline: createPipelineProvider(core),
  };
}

/** Tvar sady providerů dostupné přes `Astro.locals.providers`. */
export type Providers = ReturnType<typeof createProviders>;
