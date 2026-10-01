/**
 * Jazyky podporované scaffoldem. Slouží jako jediný zdroj pravdy pro
 * `isLocale`, překládání cest i generování `hreflang` záznamů.
 */
export const locales = ["cs", "en", "de"] as const;

/** Kód jednoho podporovaného jazyka. */
export type Locale = (typeof locales)[number];

/** Jazyk použitý, pokud nelze z URL určit jiný; česká varianta je bez prefixu. */
export const defaultLocale: Locale = "cs";
