import type { CoreClient } from "../../CoreModule/server/php-core";
import { HttpError } from "../../CoreModule/server/errors";
import type { User, LoginResult } from "../types";

/**
 * Převede odpověď php-core na veřejnou podobu uživatele.
 *
 * Ověří, že backend vrátil očekávané typy, a zahodí všechno ostatní, takže se
 * k browseru nikdy nepropírají interní pole, hash ani čas vypršení relace.
 *
 * @param data Data z php-core pro `/auth/me` nebo `/auth/login`.
 * @returns Objekt {@link User} s hodnotami bezpečnými pro veřejnou API vrstvu.
 * @throws HttpError se stavem 502 a kódem `invalid_backend_response`, pokud data
 *   nejsou objekt s celočíselným `id` a řetězcovými `email` a `role`.
 */
export function publicUser(data: User): User {
  if (
    !data ||
    !Number.isInteger(data.id) ||
    typeof data.email !== "string" ||
    typeof data.role !== "string"
  )
    throw new HttpError(502, "invalid_backend_response");
  return {
    id: data.id,
    email: data.email,
    first_name: String(data.first_name ?? ""),
    last_name: String(data.last_name ?? ""),
    role: data.role,
  };
}

/**
 * Vytvoří serverového poskytovatele auth nad klientem CoreModule.
 *
 * Provider volá php-core přes `core.request`, tedy s interním API klíčem,
 * pevným tenantem a volitelným uživatelským bearerem. Klíč ani tenant se
 * nikdy nepřijímají od klienta.
 *
 * @param core Klient z `createCoreClient`, vytvořený na jeden požadavek.
 * @returns Objekt s metodami `login`, `me` a `logout`.
 */
export function createAuthProvider(core: CoreClient) {
  return {
    /**
     * Přihlásí uživatele v php-core.
     *
     * @param email E-mail, před odesláním oříznutý.
     * @param password Heslo v čistém tvaru; nikdy se neukládá ani neloguje.
     * @returns Dvojice `{ token, user }` s tokenem a veřejnými údaji.
     * @throws HttpError 422 od php-core při špatných údajích, 502 při vadné
     *   odpovědi nebo tokenu, který neodpovídá 64 hex znakům.
     */
    async login(email: string, password: string) {
      const data = await core.request<LoginResult>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      if (
        !data ||
        typeof data.token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(data.token)
      )
        throw new HttpError(502, "invalid_backend_response");
      return { token: data.token, user: publicUser(data) };
    },
    /**
     * Načte aktuálního uživatele podle session tokenu.
     *
     * @param token Session token z cookie relace.
     * @returns Veřejné údaje {@link User}.
     * @throws HttpError 401, pokud je token neplatný nebo vypršelý,
     *   502 při vadné odpovědi php-core.
     */
    async me(token: string) {
      return publicUser(await core.request<User>("/auth/me", { token }));
    },
    /**
     * Zruší relaci na straně php-core.
     *
     * @param token Session token z cookie relace.
     * @returns `null` z obálky php-core po úspěšném odhlášení.
     * @throws HttpError 401, pokud je token neznámý, 502 při nedostupnosti.
     */
    logout(token: string) {
      return core.request<null>("/auth/logout", { method: "POST", token });
    },
  };
}

/** Tvar serverového poskytovatele auth dostupného přes `locals.providers.auth`. */
export type AuthProvider = ReturnType<typeof createAuthProvider>;
