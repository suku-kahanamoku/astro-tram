import { api } from "../../CoreModule/providers/api";
import type { User } from "../types";

/**
 * Klientský poskytovatel auth pro ostrovy na stránce profilu a přihlášení.
 * Volá výhradně veřejné routy `/api/auth/*` vlastního originu, takže se
 * spoléhá na HttpOnly cookie relace a neuchovává token v klientském stavu.
 */
export const authProvider = {
  /**
   * Načte přihlášeného uživatele.
   *
   * @param signal Volitelný `AbortSignal` pro zrušení požadavku při unmount komponenty.
   * @returns Veřejné údaje uživatele.
   * @throws ApiError 401, pokud není uživatel přihlášen.
   */
  me: (signal?: AbortSignal) => api<User>("/api/auth/me/", { signal }),
  /**
   * Přihlásí uživatele.
   *
   * @param email Přihlašovací e-mail.
   * @param password Heslo v čistém tvaru, odesílá se pouze přes HTTPS na vlastní origin.
   * @returns Veřejné údaje přihlášeného uživatele.
   * @throws ApiError 401 při špatných údajích, 422 při neplatném vstupu.
   */
  login: (email: string, password: string) =>
    api<User>("/api/auth/login/", {
      method: "POST",
      body: { email, password },
    }),
  /**
   * Odhlásí uživatele a smaže relaci.
   *
   * @returns `null`, pokud odhlášení proběhlo úspěšně.
   * @throws ApiError při chybě serveru.
   */
  logout: () => api<null>("/api/auth/logout/", { method: "POST", body: {} }),
};
