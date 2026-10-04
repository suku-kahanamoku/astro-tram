import cs from "./locales/cs.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import de from "./locales/de.json" with { type: "json" };
import { locales, type Locale } from "../modules/LangModule/config";

/**
 * Znovu vystavený výčet jazyků a typ jazyka LangModule, aby komponenty
 * nemusely importovat přímo z modulu.
 */
export { locales, type Locale } from "../modules/LangModule/config";

/**
 * Identifikátory všech rout stránky, včetně těch, které vyžadují přihlášení.
 * Pořadí položek určuje, v jakém pořadí se trasy kontrolují při resolve.
 */
export const pages = [
  "home",
  "about",
  "licenses",
  "search",
  "login",
  "account",
] as const;

/** Jeden z {@link pages}. */
export type PageId = (typeof pages)[number];

/**
 * Routy, které smějí být indexované a cacheované. Zbývající routy
 * (`login`, `account`) se v `robots.txt` zakazují.
 */
export const publicPages: PageId[] = ["home", "about", "licenses"];

/**
 * Textové slovníky jednotlivých jazyků pro různé sekce webu,
 * mapované na kód jazyka.
 */
const dictionaries = { cs, en, de } satisfies Record<Locale, typeof cs>;

/**
 * Vrátí slovník sekcí pro daný jazyk.
 *
 * @param locale Kód jazyka stránky.
 * @returns Objekt s texty pro navigaci, patičku a stavové obrazovky.
 */
export const routeDictionary = (locale: Locale) => dictionaries[locale];

/**
 * Sestaví kanonickou URL stránky v daném jazyce. Česká varianta nemá
 * jazykový prefix, ostatní jazyky jej mají, padesátka se nezdvojuje.
 *
 * @param locale Kód jazyka stránky.
 * @param page Identifikátor routy, výchozí je `home`.
 * @returns Cesta začínající a končící lomítkem, např. `/`, `/about/` nebo `/en/about/`.
 */
export function url(locale: Locale, page: PageId = "home") {
  const parts = [
    locale === "cs" ? "" : locale,
    routeDictionary(locale).routes[page],
  ].filter(Boolean);
  return parts.length ? `/${parts.join("/")}/` : "/";
}

/**
 * Převede cestu z URL na dvojici jazyk a stránka podle slovníku tras.
 *
 * @param pathname Cesta z `Astro.url.pathname`, včetně úvodního lomítka.
 * @returns Objekt `{ locale, page }`, nebo `null`, pokud cesta neodpovídá žádné routě.
 */
export function resolveRoute(
  pathname: string,
): { locale: Locale; page: PageId } | null {
  for (const locale of locales)
    for (const page of pages) {
      if (url(locale, page) === pathname) return { locale, page };
    }
  return null;
}

/**
 * Starší nonlocalizované cesty jsou pouze aliasy, nikoli další kanonické stránky.
 *
 * @param pathname Cesta z `Astro.url.pathname`.
 * @returns Kanonická cesta pro přesměrování, nebo `null`, když přesměrování není potřeba.
 */
export function legacyRedirect(pathname: string): string | null {
  for (const locale of locales) {
    for (const page of pages) {
      const legacy = `${url(locale)}${page === "home" ? "" : `${page}/`}`;
      const canonical = url(locale, page);
      if (pathname === legacy && legacy !== canonical) return canonical;
    }
  }
  return null;
}
