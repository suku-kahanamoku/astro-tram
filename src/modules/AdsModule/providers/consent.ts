/** Zpětné volání, které se spustí při změně rozhodnutí o souhlasu s reklamou. */
export type ConsentListener = (allowed: boolean) => void;

/** Registrované posluchače; množina drží i odkaz na odhlášení. */
const listeners = new Set<ConsentListener>();

/** Aktuální stav souhlasu; výchozí hodnota je zamítnutí. */
let advertising = false;

/**
 * Můstek pro souhlas s reklamou, standardně zámítnutý. Projektová CMP zavolá
 * tuto funkci po rozhodnutí uživatele. Tento můstek není CMP a nevymýšlí si
 * vendor consent stringy.
 */
export const consentProvider = {
  /**
   * Aktuální rozhodnutí o reklamě, `false` dokud souhlas nepřijde.
   *
   * @returns `true`, pokud je reklama povolena.
   */
  get advertising() {
    return advertising;
  },
  /**
   * Nastaví rozhodnutí o reklamě a rozešle změnu posluchačům.
   *
   * @param allowed `true` povolí reklamu, `false` ji odepře.
   */
  setAdvertising(allowed: boolean) {
    if (advertising === allowed) return;
    advertising = allowed;
    for (const listener of listeners) listener(allowed);
  },
  /**
   * Přihlásí posluchače a ihned ho zavolá s aktuálním stavem.
   *
   * @param listener Callback, který se spustí při každé změně rozhodnutí.
   * @returns Funkce pro odhlášení posluchače.
   */
  subscribe(listener: ConsentListener) {
    listeners.add(listener);
    listener(advertising);
    return () => {
      listeners.delete(listener);
    };
  },
};
