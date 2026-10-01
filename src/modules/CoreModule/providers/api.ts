/**
 * Chyba klientského volání veřejného API, kterou hází {@link api}.
 * `code` odpovídá poli `error` v JSON odpovědi serveru.
 */
export class ApiError extends Error {
  /**
   * @param status HTTP stav odpovědi, který vrátila aplikace.
   * @param code Krátký kód chyby ze těla odpovědi, defaultně `request_failed`.
   */
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/**
 * Volá veřejnou API routu vlastního originu a vrátí data z obálky `{ success, data }`.
 *
 * Volá se pouze z klientských ostrovů; cookie se posílá díky `credentials: "same-origin"`.
 * Žádné tajné údaje se nikdy nepřidávají do hlaviček, autorizaci řeší serverová relace.
 *
 * @param path Cesta začínající `/api/`, např. `/api/auth/me/`.
 * @param options Nepovinné `method` (defaultně `GET`), JSON `body` a `AbortSignal`.
 * @returns Data z pole `data` úspěšné odpovědi.
 * @throws Error při cestě mimo `/api/`, {@link ApiError} při neúspěšné odpovědi
 *   nebo s kódem `request_failed` při chybějícím poli `error`.
 */
export async function api<T>(
  path: `/api/${string}`,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  if (!path.startsWith("/api/") || path.includes("\\"))
    throw new Error("Invalid API path");
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    signal: options.signal,
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  if (!response.ok || !data.success)
    throw new ApiError(response.status, data.error ?? "request_failed");
  return data.data as T;
}
