import type { APIRoute } from "astro";
import { site } from "../../../config/site";
import { errorResponse, HttpError } from "../../CoreModule/server/errors";

/**
 * `GET /api/auth/me` – veřejné údaje přihlášeného uživatele.
 *
 * Nepřijímá žádný vstup ani token z dotazu; session se bere výhradně z HttpOnly
 * cookie přes `locals.getUser()`, které je na požadavek memoizované. Odpověď
 * obsahuje jen vybraná pole z `User`, nikdy role interní ani čas vypršení.
 *
 * Odpověď: `Response.json({ success: true, data: user })`.
 * Chyby: 401 `unauthorized` bez platné relace, 404 `not_found` při vypnutém
 * modulu auth, 502 při nedostupnosti backendu. Odpověď je `no-store`.
 */
export const meHandler: APIRoute = async ({ locals }) => {
  try {
    if (!site.modules.auth) throw new HttpError(404, "not_found");
    const user = await locals.getUser();
    if (!user) throw new HttpError(401, "unauthorized");
    return Response.json({ success: true, data: user });
  } catch (error) {
    return errorResponse(error);
  }
};
