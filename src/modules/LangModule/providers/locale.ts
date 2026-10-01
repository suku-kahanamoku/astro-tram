import { locales, defaultLocale, type Locale } from "../config";

/** Znovu vystavený výčet jazyků, výchozí jazyk a typ jazyka pro ostatní moduly. */
export { locales, defaultLocale, type Locale } from "../config";

/**
 * Ověří, zda hodnota odpovídá podporovanému jazyku.
 *
 * @param value Libovolný řetězec, např. z URL nebo z formuláře.
 * @returns `true`, pokud je hodnota jedním z jazyků {@link locales}.
 */
export const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);

/**
 * Určí jazyk stránky z cesty URL.
 *
 * První segment cesty musí být kód jazyka; česká varianta prefix nemá,
 * a proto vrací výchozí jazyk.
 *
 * @param pathname Cesta z `Astro.url.pathname`.
 * @returns Kód jazyka, jinak {@link defaultLocale}.
 */
export function localeFromPath(pathname: string): Locale {
  const segment = pathname.split("/")[1] ?? "";
  return isLocale(segment) ? segment : defaultLocale;
}

/**
 * Modul dodává vlastní kompletní slovník; žádný globální registr funkcí.
 *
 * @param dictionaries Slovníky jednotlivých jazyků, klíč odpovídá {@link Locale}.
 * @returns Funkce, která pro zadaný jazyk vrátí jeho slovník.
 */
export function createDictionary<T>(dictionaries: Record<Locale, T>) {
  return (locale: Locale): T => dictionaries[locale];
}
