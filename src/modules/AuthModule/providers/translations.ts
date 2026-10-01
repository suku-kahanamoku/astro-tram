import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import { createDictionary } from "../../LangModule/providers/locale";

/**
 * Slovníky AuthModule pro jednotlivé jazyky; obsahují texty přihlášení,
 * profilu a stavové zprávy. `cs` slouží jako typová šablona.
 */
export const dictionary = createDictionary<typeof cs>({ cs, en, de });
