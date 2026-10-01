import type { APIRoute } from "astro";
import { site } from "../../../config/site";
import { HttpError, errorResponse } from "../../CoreModule/server/errors";
import { clearToken, readToken } from "./session";
import { readFields } from "../../CoreModule/server/request";
import { isLocale, type Locale } from "../../LangModule/providers/locale";
import { url } from "../../../config/routes";

/**
 * `POST /api/auth/logout` – ukončení relace.
 *
 * Vstup: JSON nebo formulář s volitelným polem `locale` pro návrat na lokalizovanou
 * adresu. Token se čte pouze z cookie; chyba 401 z php-core se při odhlašování
 * ignoruje, aby relace zmizela i po vypršení. Cookie se vždy smaže.
 *
 * Odpověď: u formuláře přesměrování 303 na přihlášení, u JSON volání
 * `Response.json({ success: true, data: null })`.
 * Chyby: 404 při vypnutém modulu auth, 502 při nedostupnosti backendu;
 * u formuláře přesměrování zpět na profil s `?error=logout`.
 */
export const logoutHandler: APIRoute = async (context) => {
  let locale: Locale = "cs";
  const form = context.request.headers
    .get("content-type")
    ?.startsWith("application/x-www-form-urlencoded");
  try {
    if (!site.modules.auth) throw new HttpError(404, "not_found");
    const data = await readFields(context.request);
    if (typeof data.locale === "string" && isLocale(data.locale))
      locale = data.locale;
    const token = readToken(context.cookies);
    if (token) {
      try {
        await context.locals.providers.auth.logout(token);
      } catch (error) {
        if (!(error instanceof HttpError && error.status === 401)) throw error;
      }
    }
    clearToken(context.cookies);
    return form
      ? context.redirect(url(locale, "login"), 303)
      : Response.json({ success: true, data: null });
  } catch (error) {
    return form
      ? context.redirect(`${url(locale, "account")}?error=logout`, 303)
      : errorResponse(error);
  }
};
