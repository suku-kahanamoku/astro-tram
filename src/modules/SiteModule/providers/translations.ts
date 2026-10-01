import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import { createDictionary } from "../../LangModule/providers/locale";

/**
 * Slovníky SiteModule pro jednotlivé jazyky; texty navigace, patičky,
 * stavových obrazovek a pásu značky. `cs` slouží jako typová šablona.
 */
export const dictionary = createDictionary<typeof cs>({ cs, en, de });
