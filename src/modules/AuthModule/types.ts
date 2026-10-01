/**
 * Osobní údaje uživatele, které smějí opustit serverovou vrstvu.
 * Jde o výslovně vybranou část odpovědi php-core, ne o celý záznam.
 */
export interface User {
  /** Celé číslo identifikátoru uživatele z php-core. */
  id: number;
  /** Přihlašovací e-mail. */
  email: string;
  /** Křestní jméno, prázdný řetězec, pokud backend hodnotu neposkytne. */
  first_name: string;
  /** Příjmení, prázdný řetězec, pokud backend hodnotu neposkytne. */
  last_name: string;
  /** Role uživatele; oprávnění nad daty vždy vyhodnocuje php-core. */
  role: string;
}

/**
 * Odpověď php-core na úspěšné přihlášení: veřejné údaje doplněné o relaci.
 */
export interface LoginResult extends User {
  /** Session token, 64 hex znaků; ukládá se výhradně do HttpOnly cookie. */
  token: string;
  /** Čas vypršení relace ve tvaru ISO 8601; aplikace jej neparsuje. */
  expires_at: string;
}
