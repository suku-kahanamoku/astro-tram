import { defineMiddleware } from "astro:middleware";
import { assertSameOrigin, requestOrigin } from "./request";
import { errorResponse } from "./errors";

/**
 * Společná lifecycle pro požadavek i odpověď. Trasování přidávejte zde,
 * nikdy v logu cookies ani těl požadavku.
 *
 * - každému požadavku přiřadí `requestId` a vrátí ho v hlavičce `X-Request-Id`,
 * - u zápisových metod pod `/api/` vyžaduje shodný origin (ochrana proti CSRF);
 *   kompozice může označit konkrétní veřejné čtecí POST routy jako výjimku,
 * - přidá bezpečnostní hlavičky a na API či soukromé stránce `Cache-Control: no-store`.
 */
export function createRequestHook(
  isPublicRead: (request: Request) => boolean = () => false,
) {
  return defineMiddleware(async (context, next) => {
    context.locals.requestId = crypto.randomUUID();
    if (
      context.url.pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(context.request.method) &&
      !isPublicRead(context.request)
    ) {
      try {
        assertSameOrigin(
          context.request,
          requestOrigin(context.url, context.site, import.meta.env.DEV),
        );
      } catch (error) {
        return errorResponse(error);
      }
    }
    const response = await next();
    response.headers.set("X-Request-Id", context.locals.requestId);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set(
      "Referrer-Policy",
      context.locals.sameOriginForms
        ? "same-origin"
        : context.locals.privatePage
          ? "no-referrer"
          : "strict-origin-when-cross-origin",
    );
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    if (context.url.pathname.startsWith("/api/") || context.locals.privatePage)
      response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}

export const requestHook = createRequestHook();
