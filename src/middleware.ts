import { legacyRedirect } from "./config/routes";
import { defineMiddleware, sequence } from "astro:middleware";
import { createRequestHook } from "./modules/CoreModule/server/requestHook";
import { isPublicTransportRead } from "./modules/TransportModule/server/requestPolicy";
import { sessionHook } from "./modules/AuthModule/server/sessionHook";
import { createProviders } from "./server/providers";

/**
 * Společná řetěz middleware pro každý požadavek. Pořadí je záměrné:
 *
 * 1. trvalé přesměrování starších nonlocalizovaných aliasů,
 * 2. `requestHook` z CoreModule: `requestId`, kontrola originu u mutací
 *    a bezpečnostní hlavičky odpovědi,
 * 3. vytvoření serverových providerů pro daný požadavek,
 * 4. `sessionHook` z AuthModule: odložené načtení uživatele z relace.
 */
export const onRequest = sequence(
  defineMiddleware((context, next) => {
    if (context.request.method === "GET" || context.request.method === "HEAD") {
      const target = legacyRedirect(context.url.pathname);
      if (target) return context.redirect(target + context.url.search, 308);
    }
    return next();
  }),
  createRequestHook(isPublicTransportRead),
  defineMiddleware(async (context, next) => {
    context.locals.providers = createProviders();
    return next();
  }),
  sessionHook,
);
