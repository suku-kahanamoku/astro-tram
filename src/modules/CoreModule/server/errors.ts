/**
 * Chyba serverové vrstvy s bezpečným, uživateli viditelným kódem.
 *
 * Obsahuje pouze stav a krátký kód, žádnou zprávu z php-core, URL ani tajné údaje,
 * aby se přes API nikdy neodhalila interní chyba.
 */
export class HttpError extends Error {
  /**
   * @param status HTTP stav, který se má vrátit návštěvníkovi.
   * @param code Krátký stabilní kód chyby, např. `unauthorized`.
   */
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/**
 * Převede libovolnou chybu na JSON odpověď ve tvaru
 * `{ success: false, error: <kod> }`.
 *
 * Známé {@link HttpError} si ponechají svůj stav a kód, cokoli jiného se
 * přemění na 500 `internal_error`. Odpověď je vždy `no-store`, protože
 * soukromé ani chybové payloady nejsou cacheovatelné.
 *
 * @param error Chyba zachycená v `catch` větvi.
 * @returns `Response` s JSON tělem a hlavičkou `Cache-Control: no-store`.
 */
export function errorResponse(error: unknown): Response {
  const known = error instanceof HttpError;
  return Response.json(
    { success: false, error: known ? error.code : "internal_error" },
    {
      status: known ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
