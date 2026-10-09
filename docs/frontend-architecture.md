# Frontend Trambus: architektura a cache

Kontrola a refaktor: 9. 10. 2026. Tento dokument popisuje lokální implementaci;
nejde o potvrzení nasazení ani provozních parametrů produkčního backendu.

## Kompozice a hranice

`src/pages/[...path].astro` sestavuje 18 předrenderovaných stránek. HTML nečeká
na přihlášení, katalog, hledání ani realtime. Middleware během prerenderu
nevytváří runtime providery a relaci. Zvláštní hlavičky předrenderovaných stránek
zajišťuje `scripts/static-page-headers.ts` pro Node i Netlify.

| Modul                                    | Odpovědnost a vykreslování                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| UIModule                                 | Astro pro statické ikony a motiv; React pro formulářové prvky, dialogy, collapse, toast, kopírování a theme. Nezná dopravní API.                    |
| LangModule                               | Jazykové registry a helpery; interaktivní přepínač v Reactu. Modulové slovníky zůstávají oddělené.                                                  |
| CoreModule                               | Sdílený klientský JSON transport; oddělené serverové klienty Java a PHP, bezpečnost požadavků.                                                      |
| SiteModule                               | Hlavička, patička a sdílený `BrandLink.astro`; oprávnění a přepínač plánovačů v Reactu.                                                             |
| LandingModule / ContentModule            | Informační sekce v Astro, kroky, FAQ a prezentace. Obrázky se optimalizují při buildu.                                                              |
| AuthModule                               | React formulář a profil; session a tajné credentials výhradně na serveru. HTML profilu neobsahuje osobní údaje.                                     |
| AdsModule                                | React aktivace reklamy až se souhlasem a viditelností. Při vypnutém modulu je obal stránky čisté Astro.                                             |
| TransportCoreModule                      | Sdílené kontrakty, URL, prezentace a klientské endpointy. Barvy prostředků dodává Java.                                                             |
| TransportSearchModule                    | React formulář, `SearchOptions`, výběr míst a měst; hooky oddělují async načítání a debounce.                                                       |
| TransportJourneyModule                   | `JourneyResults` → `JourneyCard` → `JourneySummary` / `JourneyDetail`; sdílené zastávky, status spoje, časy, stránkování a statické trip resources. |
| TransportTrackingModule / RealtimeModule | Doménová pozorování a jejich projekce, nezávislý socket transport. Malé odběry přes external store.                                                 |
| TransportMapModule / OSMModule           | Dopravní adaptér nad obecnou React mapou; OpenLayers se načítá dynamicky a spravuje pouze vlastní ref podstrom.                                     |
| TransportModule                          | Kompozice hledání, výsledků, tracking a map; serverová validace a projekce veřejných odpovědí.                                                      |

Informativní zastávky v detailu zůstávají React komponentami: jejich data dorazí
až po hydrataci a jsou součástí reaktivního stromu. Astro není druhý renderer
pro stejná dynamická data. Astro/React varianty ikon sdílejí SVG cesty.

Závislosti, cykly a tranzitivní serverové importy do browseru kontroluje
`tests/architecture.test.ts`. Nová funkcionalita má rozšiřovat existující doménu,
nikoli vytvářet druhou variantu transportního, dialogového či mapového jádra.

## Datový tok

1. Formulář validuje lokální vstup a okamžitě přejde na výsledkovou URL s kotvou.
2. Browser načte veřejné HTML a plynule posune výsledkovou sekci do záběru.
3. `useJourneySearch` podle URL případně vyřeší nevybraný text a aktuální GPS,
   teprve poté zavolá hledání. Backend není součástí prvního renderu HTML.
4. Otevřený detail a osa sdílejí statický trip; případné souřadnice jsou samostatné
   obohacení a nepřepisují statické řádky ani plánované časy.
5. HTTP observation a WebSocket samostatně aktualizují polohu a zpoždění.
   Přijatá odpověď sama nepotvrzuje dostupnou GPS ani jízdu včas.

`JourneyRiskProvider` vyhodnocuje návaznosti jednou pro otevřenou cestu. Realtime
aktualizace se předávají pouze malým risk notices; nemají znovu vykreslovat celou
statickou cestu. Zavřené accordiony díky `Collapse` své detaily nemountují.

## Cache a platnost dat

| Vrstva                   | Co drží                                                                          | Rozsah / invalidace                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Java                     | Statické odpovědi, katalogy a detaily podle aktuální generace grafu/indexu.      | Backend kontroluje identitu a aktuálnost; jeho RAM cache nemění HTTP soukromí.                                                                         |
| Astro BFF                | Validace a projekce; **žádná dodatečná časová cache měst**.                      | Každý požadavek předá ověření aktuální generace Java. Soukromé GPS pořadí nesdílí.                                                                     |
| Browser static responses | Pouze veřejná statická presentation, attribution, coverage, cities, trip a stop. | Paměť aktuální stránky, TTL 15 s / 60 s / 300 s podle druhu, 128 položek / 8 MiB, nejvýše 32 sdílených pending záznamů. Bez storage a service workeru. |
| TripResources            | Detail a volitelné souřadnice, sdílené načtení osou a dialogem.                  | Jedno vyhledávání; nová URL hledání obnoví resources a zruší staré požadavky. Nejvýše 100 hotových položek / 8 MiB; dvě současná načítání.             |
| Tracking                 | Aktuální pozorování a explicitně označená poslední známá poloha/zpoždění.        | Vlastní čerstvost a expiry; **nejde o cache API odpovědí**.                                                                                            |

Browser cache nekopíruje backendové výsledky hledání. `search`, `observation`,
`tracking`, Places a GPS cities jdou vždy na API; GPS zůstává v POST těle.
Statické odpovědi obsahující realtime, polohu, zpoždění, očekávané časy,
částečný výsledek, zrušení nebo ticket se neuchovávají. Chyby se opakují novým
požadavkem. Souběžní odběratelé sdílejí síťové načítání, ale dostávají nezávislé
kopie; zrušení posledního odběratele ruší sdílený požadavek. Limit pending cache
omezuje její evidenci; požadavek nad limitem ji obejde.

Frontendový TTL znamená krátké zobrazení již načteného statického snapshotu.
Neprokazuje platnost starého opaque ID v novém indexu: backend při hledání znovu
validuje předané identity a `stale_resource` vede k opětovnému výběru místa.
Realtime a zpoždění nikdy nepřejímají tento TTL.

`CoreModule/providers/api.ts` společně obsluhuje JSON obálku, cookies stejného
originu, `no-store`, chyby včetně HTML error pages, `Retry-After`, zrušení a timeout.
Auth a administrace mají 15 s; transport 30 s, aby klient předčasně neukončil
serverové hledání s limitem 25 s. Žádné interní credentials se neposílají browserem.

## Ověřené optimalizace

- Informační sekce a motiv dopravy jsou Astro komponenty bez React hydratace.
- Neaktivní AdsModule nevytváří React island obalu stránky.
- Dvě původní PNG ilustrace (přibližně 5,2 MB dohromady) mají WebP varianty
  480/768/1024/1536 px a `srcset`. Build vytvořil součet největších variant
  přibližně 453 kB; mobil může použít menší variantu. Druhá ilustrace zůstává lazy.
  Netlify má `imageCDN: false`, takže také servíruje hotové buildové varianty.
- Formátování kilometrů používá jeden Intl formatter na seznam a locale.
- Rozbalené cesty se odvozují jednou pro seznam; stejná sada slouží trackingu.
- Plánované časy, datové kontrakty, explicitní výběr města a pořadí katalogu
  z backendu refaktor zachovává.

## Validace a další změny

Povinné kontroly: `npm test`, `npm run build`, `npm run format:check` a při layoutu
či auth `npm run test:browser`. Browser mock není ověřením reálného dopravce,
realtime gateway, OSM dlaždic ani produkční odezvy.

Před refaktorem: 162 unit testů prošlo; browser sada měla 137 úspěšných a 29
selhávajících testů. Část očekávání popisuje dřívější realtime indikátor a odhad
polohy. Výchozí selhání se nesmí zaměnit za nový výsledek refaktoru; současně je
nelze považovat za úspěšnou browser validaci. Aktuální běh je potřeba porovnat
podle jednotlivých scénářů.

### Závěrečné lokální ověření

- `npm test`: 172 / 172 úspěšných testů.
- Node a Netlify build: překlady a TypeScript bez chyb; oba adaptéry předrenderují 18 stránek.
- `npm run format:check` a `git diff --check`: bez chyb.
- Produkční Node HTML s blokovaným fetch: 18 / 18 stránek, **0 backendových dotazů**.
- Izolovaná kompletní browser sada: **139 / 167 úspěšných**, 28 selhání.
  Všech 28 bylo v původní sadě také; nové funkční selhání nepřibylo.
  Přetrvávají například starší očekávání tečky mimo hranice úseku, nulového
  zpoždění a původního rozmístění patičky, ale také neuzavřené kontroly geometrie
  mapového dialogu a stabilních řádků. Browser sada tedy není celá zelená.
- Nové cache/timeout scénáře, zachování GPS, přestupní rizika, anonymní načítání,
  admin přepínač, mobilní formulář, explicitní město a společná OSM mapa procházejí.

Změny jsou lokální. Produkce ani živá Java/realtime služba nebyly v tomto refaktoru
nasazeny nebo integračně ověřeny; výkon lokálního HTML není měření Netlify TTFB.
