import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import type { Locale } from "../../LangModule/config";
const translations = { cs, en, de } satisfies Record<Locale, typeof cs>;
export const dictionary = (locale: Locale) => translations[locale];
