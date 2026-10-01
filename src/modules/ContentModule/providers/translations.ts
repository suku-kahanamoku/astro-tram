import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import { createDictionary } from "../../LangModule/providers/locale";

/**
 * Slovníky ContentModule pro jednotlivé jazyky; texty úvodní a sekce
 * O projektu včetně pole `cards` pro jednotlivé karty. `cs` je typová šablona.
 */
export const dictionary = createDictionary<typeof cs>({ cs, en, de });
