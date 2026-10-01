import type { AstroCookies } from "astro";

/** Název cookie, ve které držíme session token z php-core. */
const cookieName = "scaffold_session";

/**
 * Načte session token z cookie relace.
 *
 * @param cookies Cookie kontext požadavku z `Astro.cookies`.
 * @returns Hodnota tokenu, nebo `undefined`, pokud relace není nastavena.
 */
export const readToken = (cookies: AstroCookies) =>
  cookies.get(cookieName)?.value;

/**
 * Uloží session token do cookie relace.
 *
 * Cookie je HttpOnly (nedostupná JavaScriptu), `SameSite=Lax` a sdílí celou
 * cestu webu; při lokálním vývoji přes HTTP není `secure`. Relace: php-core
 * zůstává autoritativní pro vypršení tokenu, `expires_at` se zde neparsuje.
 *
 * @param cookies Cookie kontext požadavku.
 * @param token Session token vrácený php-core.
 * @param secure `true`, pokud stránka běží přes HTTPS nebo v produkci.
 */
export function writeToken(
  cookies: AstroCookies,
  token: string,
  secure: boolean,
) {
  // Session cookie: php-core remains authoritative for token expiry; no timezone parsing of expires_at.
  cookies.set(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Smaže cookie relace v prohlížeči.
 *
 * @param cookies Cookie kontext požadavku.
 */
export function clearToken(cookies: AstroCookies) {
  cookies.delete(cookieName, { path: "/" });
}
