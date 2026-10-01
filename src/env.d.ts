/// <reference types="astro/client" />

/**
 * Data, která Astro middleware vloží do `Astro.locals` a která jsou dostupná
 * v komponentách, routách a serverových handlerech.
 */
declare namespace App {
  /** Kontext požadavku dostupný komponentám a serverovým handlerům. */
  interface Locals {
    /** Identifikátor požadavku z `CoreModule`, vrací se v hlavičce `X-Request-Id`. */
    requestId: string;
    /**
     * Značka, že stránka zobrazuje data přihlášeného uživatele.
     * Nastavuje se ve frontmatteru routy; middleware pak přidá
     * `Cache-Control: private, no-store`.
     */
    privatePage?: boolean;
    /** Sada serverových providerů vytvořená pro tento požadavek v `src/server/providers.ts`. */
    providers: import("./server/providers").Providers;
    /**
     * Načte přihlášeného uživatele z relace. Volání je memoizované na jeden
     * požadavek; při chybě 401 se relace smaže a vrátí se `null`.
     */
    getUser: () => Promise<import("./modules/AuthModule/types").User | null>;
  }
}
