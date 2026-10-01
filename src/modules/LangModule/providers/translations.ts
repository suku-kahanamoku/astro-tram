import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import { createDictionary } from "../providers/locale";

/**
 * Slovníky LangModule pro jednotlivé jazyky; `name` je název jazyka ve vlastním
 * jazyce a `label` popisek skupiny v přepínači jazyků.
 */
export const dictionary = createDictionary<typeof cs>({ cs, en, de });
