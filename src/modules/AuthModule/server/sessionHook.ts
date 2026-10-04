import { defineMiddleware } from "astro:middleware";
import { clearToken, readToken } from "./session";
import { HttpError } from "../../CoreModule/server/errors";
import type { User } from "../types";

/**
 * Middleware, které vloží do `Astro.locals` funkci `getUser` pro načtení
 * přihlášeného uživatele.
 *
 * Načtení je odložené a memoizované na jeden požadavek, takže stránka, která
 * uživatele nepotřebuje, žádný požadavek na php-core nevytvoří. U neplatné
 * relace (401) se cookie smaže a vrátí se `null`, jiné chyby se propagateří.
 */
export const sessionHook = defineMiddleware(async (context, next) => {
  context.locals.sessionToken = readToken(context.cookies);
  let userPromise: Promise<User | null> | undefined;
  context.locals.getUser = () =>
    (userPromise ??= (async () => {
      const token = readToken(context.cookies);
      if (!token) return null;
      try {
        return await context.locals.providers.auth.me(token);
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
          clearToken(context.cookies);
          return null;
        }
        throw error;
      }
    })());
  return next();
});
