import { HttpError } from "./errors";

/**
 * Ověří, že zápisový požadavek přišel ze stejného originu jako web.
 *
 * Kontroluje hlavičku `Origin` a odmítá i požadavky označené
 * `Sec-Fetch-Site: cross-site`. Slouží jako obrana proti CSRF u mutací
 * pod `/api/`, které se volají z prohlížeče.
 *
 * @param request Původní `Request`, u něhož se kontrolují hlavičky originu.
 * @param expectedOrigin Origin, s nímž musí `Origin` souhlasit; u `astro:config` jde o `site`, jinak o origin z URL.
 * @returns Nic, pokud je požadavek důvěryhodný.
 * @throws HttpError se stavem 403 a kódem `invalid_origin`, pokud origin neodpovídá.
 */
export function assertSameOrigin(request: Request, expectedOrigin: string) {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "invalid_origin");
}

/**
 * Načte a zvaliduje tělo formuláře či JSON požadavku.
 *
 * Přijímá pouze `application/json` a `application/x-www-form-urlencoded`,
 * tělo čte po kouscích a odmítne ho, jakmile překročí 16 KiB. Výsledkem musí
 * být objekt, nikoli pole ani primitivum.
 *
 * @param request Původní `Request` s tělem ke čtení.
 * @returns Objekt polí požadavku, hodnoty zůstávají `unknown` a validují se v handlerech.
 * @throws HttpError 415 `unsupported_media_type` pro jiný typ obsahu,
 *   422 `invalid_input` bez těla či při chybném formátu, 413 `body_too_large` nad limit.
 */
export async function readFields(
  request: Request,
): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type")?.split(";")[0];
  if (
    type !== "application/json" &&
    type !== "application/x-www-form-urlencoded"
  )
    throw new HttpError(415, "unsupported_media_type");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(422, "invalid_input");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw new HttpError(413, "body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const data =
      type === "application/json"
        ? JSON.parse(text)
        : Object.fromEntries(new URLSearchParams(text));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    return data;
  } catch {
    throw new HttpError(422, "invalid_input");
  }
}
