import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import { createDictionary } from "../../LangModule/providers/locale";

/**
 * Slovníky AdsModule pro jednotlivé jazyky.
 * `cs` slouží jako typová šablona, takže struktura všech jazyků musí souhlasit.
 */
export const dictionary = createDictionary<typeof cs>({ cs, en, de });
