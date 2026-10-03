# astro-tram

TRAM frontend postavený z `astro-scaffold`. Astro SSR + React + TypeScript, sdílený serverový klient php-core, OpenLayers načítané až při otevření mapy. Samostatný projekt; výchozí scaffold a Sorry Jako zůstávají beze změn.

## Spuštění

```sh
npm ci
cp .env.example .env
npm run dev
```

Dev server a Playwright mají oddělenou cache Astro/Vite, aby testy nezneplatnily dynamické importy OpenLayers v otevřeném náhledu. Prohlížečový test mapy ověřuje i viditelný canvas, ne pouze otevření dialogu.

Bez nastaveného backendu funguje landing a formulář; vyhledávání přizná nedostupnost zdroje. Aplikace nemá demo výsledky ani automatický přechod na mock.

Serverové proměnné:

- `PUBLIC_SITE_URL`: kanonická adresa webu; v produkci musí být shodná s originem zápisových POST požadavků. Při `npm run dev` kontrolujeme skutečný origin běžícího serveru. Veřejné čtecí POST `/api/transport/places/` a `/api/transport/search/` origin nevyžadují; vstupy, velikost těla a backendové limity se stále ověřují. Přihlášení, změny účtu a vytváření tracking ticketu nadále vyžadují shodný origin.
- `PHP_CORE_URL`: kořen php-core API včetně `/api`, bez `/transport/v1`.
- `PHP_CORE_API_KEY`: interní klíč backendu, pouze na serveru.
- `PHP_CORE_TENANT_HOST`: pevný host mapovaný v php-core na `tram`, např. `tram.localhost`.

Interní API klíč ověřuje serverové volání Astro → php-core. Pevný tenant host vybírá datový tenant; nepřebírá se z hostu prohlížeče. Klíč se do prohlížeče neposílá.

Backend musí mít aplikované `schema.sql`, `tram_schema.sql`, `tram_seed.sql`, host ve `FRANCHISE_CODES` a nakonfigurované skutečné providery přes `transport-configure.php`. Samotná DB migrace poskytovatele nezapíná. Pokud backend nemá žádný zdroj pro zvolenou oblast (`sources: []`), našeptávač zobrazí chybějící připojení dat; nejde o úspěšné hledání bez nalezených zastávek. PID vyžaduje Golemio token; OTP fallback vyžaduje hotový graf. Entur pokrývá Norsko. Dosavadní PID online plánování umí jen přímé spojení nebo jeden přestup mezi přesnými zastávkami; GPS a ruční mapový bod mohou u tohoto zdroje vrátit nepodporovanou schopnost. Frontend toto omezení zobrazuje.

## Struktura

Výsledky GPS hledání již nevykreslují zvláštní upozornění o nástupní/cílové
zastávce ani nezapočítané pěší cestě. Vybrané zastávky zůstávají v datech
výsledku a trase. Lokální Java backend má vlastní IDS JMK realtime adaptér
a WebSocket; dialog dostane statické zastávky hned a živá měření upravují
časovou osu a zpoždění. Historický nebo budoucí spoj nemusí mít živé měření.

- `src/config/site.ts`, `routes.ts`: brand, aktivní moduly a jazykové URL.
- `LandingModule`: intro, vysvětlení, ilustrace, FAQ.
- `TransportModule`: facade, URL orchestrace, overlay composition a serverové HTTP handlery.
- `TransportCoreModule`: transportní typy, klient, validace, geolokace, konfigurace a locale.
- `TransportSearchModule`: formulář, našeptávač, katalog měst a online hledání.
- `TransportJourneyModule`: výsledky, detaily jízd, zastávky, timeline a výpočty průběhu.
- `TransportTrackingModule`: transportní realtime pozorování, zpoždění a tracking subscriptions.
- `TransportMapModule`: transportní mapový dialog a adapter pro obecný `MapModule`.
- `MapModule`: znovupoužitelné OpenLayers jádro, lifecycle mapy, route rendering a GPS picking.
- `CoreModule/server/php-core.ts`: jediný HTTP klient k php-core. Klíč i pevný tenant zůstávají na serveru; žádný univerzální proxy endpoint.
- `UIModule`: theme, základní ovládací prvky a ikony.
- `LangModule`: čeština, angličtina, němčina; společné komponenty pro všechny jazyky.
- `SiteModule`: hlavička, patička, SEO.

Základní moduly Auth, Ads a Realtime ze scaffoldu jsou zachované pro další vývoj; v konfiguraci TRAM jsou vypnuté. Frontend neprodává jízdenky ani netvrdí dostupnost nativních mobilních aplikací.

## React a klientský stav

Klientské chování vlastní React přes `@astrojs/react`. Astro komponenty skládají
stránky, předávají serializovatelné props a spouštějí interaktivní celky přes
`client:load`. Serverové handlery, mapování php-core, validace a protokolové
providery jsou samostatné TypeScript moduly. Backendové klíče zůstávají na serveru.

- `TransportApp` skládá formulář, výsledky a dialogy; původní DOM inicializátor
  `useTransport.ts` je odstraněný. Nevykresluje se přes `innerHTML`.
- `SearchForm`, `PlaceField` a `CityPicker` používají společný `Combobox` z UIModule.
  `useAsyncOptions` řeší debounce, rušení požadavků a ignorování starých odpovědí.
  Formulář se zpřístupní po hydrataci a ověření schopností tenantu přes
  `/api/transport/coverage/` → php-core `/transport/v1/coverage`.
  `CountryTabs` zpřístupní zemi pouze s primárním našeptávačem a plánovačem;
  nepřipravené země zůstávají označené a neklikatelné. Výpadek načtení pokrytí
  nabízí opakování. Záložky se zalamují i na mobilu a ovládají se šipkami.
  Seznam měst se načítá jen při deklarované podpoře této operace. Přepnutí země
  vymaže město i obě zastávky předchozí země. Primární zdroje se nezastupují
  lokálním OTP jen kvůli chybějící integraci. SK/AT/PL záložka není tvrzení,
  že je pro zemi již nasazený online plánovač; AU znamená Austrálii, AT Rakousko.
- `useJourneySearch` vlastní online hledání, chyby a opakování dotazu;
  `useTrip` načítá detail pouze pro otevřený pohled. Výsledky se neukládají do
  browser storage. Klientské limity, středy map a BFF endpointy jsou v
  `TransportCoreModule/config/client.ts`.
- `JourneyResults`, `TripStops` a `TripLegend` jsou React komponenty. Poznámky
  poskytovatelů se vykreslují jako text a odkazy mají kontrolovaný protokol.
- `UrlNavigationProvider` a `NavLink` z UIModule obsluhují URL a historii;
  `LocalNavigationProvider` drží přechodný stav detailů v Reactu bez změny historie.
  Zavření dialogů zachovává výběr a vrací fokus.
- `MapDialog` a `useMapView` řídí mapu. OpenLayers se importuje až při otevření,
  spravuje pouze canvas podstrom a při uzavření se odpojí spolu s GPS watch/timerem.
- `LanguagePicker`, `MainMenu`, přepínání motivu a reklamní komponenty používají
  React stav a efekty s cleanupem. `ThemeInit` je React inicializace při hydrataci;
  první vykreslení používá serverový motiv, bez původního inline skriptu.
- `useAds` čeká na souhlas CMP i viditelnost slotu. Provider reklamního SDK má
  vlastní ref kontejner; změny uvnitř něj nekolidují s Reactem.
- `useRealtime` je React hook se stavem spojení, chybou a `send`; efekt otevírá
  WebSocket a při odpojení komponenty jej zavírá. Samotný protokol zůstává v provideru.

Základní React komponenty nemají znalost Transportu. Modulové závislosti a zákaz
serverových importů v browseru hlídají architektonické testy také pro `.tsx`.
Playwright má navíc scénáře pro hydrataci, jazykový přepínač, opakované připojení
mobilního menu, reklamní souhlas a opožděné odpovědi našeptávače. Testovací React
harness leží v `tests/`, není aplikační routou a nevstupuje do produkčního buildu.

## URL a obnova stránky

České výsledky jsou na `/spojeni/`, anglické `/en/journeys/`, německé `/de/verbindungen/`.

URL nese identitu a popis obou míst, čas jako RFC3339, příjezd/odjezd, přímé spojení a oblast. Stav accordionů, mezilehlých zastávek a dialogů se drží pouze v Reactu prostřednictvím `LocalNavigationProvider`; jejich otevření ani zavření nevolá `pushState`, `replaceState` nebo nové vyhledávání. Více accordionů může být otevřeno současně. Po obnovení stránky jsou všechny zavřené; staré parametry `journey`, `expanded`, `leg`, `stops`, `map`, `stopLeg`, `stopSide` a `tripStop` se při inicializaci ignorují. Interní pomocné URL slouží pouze ke skládání lokálního stavu. Vyhledávací parametry a ručně vybraný bod se nadále ukládají do skutečné URL. Mapa zastávky se otevírá nad detailem spoje; zavření vrací fokus na danou zastávku.

Po refreshi proběhne nové online vyhledání. Identita detailu se odvozuje ze spojů, zastávek a plánovaných časů, nikoli z krátkodobého ID databázové cache. Pokud původní cesta už není v aktuálních výsledcích, UI to oznámí. Výsledky nejsou historický snapshot.

`coordinates` jsou ručně vybraný bod pro plánování a mohou být v URL. `current_location` je aktuální GPS poloha: URL obsahuje jen tuto volbu, nikdy GPS souřadnice ani čas měření. Po každém obnovení se získá nový fix s `maximumAge: 0`; použije se pouze do 30 sekund a jen v těle POST požadavku. V URL, localStorage ani sessionStorage se GPS neukládá. Při zamítnutí polohy UI vyzve k výběru zastávky. Sdílený odkaz s „mojí polohou“ použije polohu příjemce.

Datum a čas formuláře i výsledků se zobrazují v časovém pásmu zařízení. URL a backendový dotaz nesou jednoznačný časový okamžik. Formulář odmítá neexistující místní čas při jarním přechodu na letní čas.

## Veřejná serverová vrstva

- `GET /api/transport/places/?q={"name":{"$regex":"Praha"},"state":"CZ"}`: povolený `q` filtr, nejvýše 20 míst pod `data`; předává standardní filtr na php-core `POST /transport/v1/places/search`. Volitelné `city` omezuje obec.
- `GET /api/transport/cities/?q={"state":"CZ"}`: online katalog obcí, přes php-core `POST /transport/v1/cities/search`; pouze vybraná veřejná pole. Stejnojmenné obce jsou sloučené, protože filtr cest pracuje s názvem města.
- `POST /api/transport/search/`: doménový příkaz nad existujícím kontraktem TRAM (`from-dest`, `to-dest`, právě jeden `from-date`/`to-date`, `state`, `city`, `location`, `max-transfers`, `limit`). Není generické prohledávání tabulky. Validace vstupu, originu a limit těla 16 KiB.
- `GET /api/transport/trip/?id=...`: konkrétní provozní jízda a její zastávky.
- `GET /api/transport/stop/?id=...`: veřejný detail zastávky z php-core; pro mapu doplní souřadnice chybějící ve výsledku hledání.

Vyhledávání má serverový HTTP limit 25 sekund, aby php-core mohlo dokončit rozlišení zastávek i přechod na záložní zdroj; ostatní požadavky mají limit 10 sekund. Provider whitelistuje odpovědi, nepředává surové chyby ani interní metadata. HTTP odpovědi API a výsledkové stránky mají `Cache-Control: private, no-store`; výsledky se neindexují. Backend nadále kontroluje tenant a limity.

## Mapa a realtime

OpenLayers + standardní OSM dlaždice s atribucí. Mapu lze ovládat myší i klávesnicí; alternativou je zadání WGS84 souřadnic. Pro větší produkční provoz nakonfigurujte vhodného poskytovatele mapových dlaždic.

Mapa spojení vykresluje jen dostupnou plánovanou geometrii a zastávky. Nevymýšlí trasu přímkou a nezobrazuje zastávku jako polohu vozidla. Průběžné sledování vozidla není v této první verzi frontendu implementované. GPS uživatele se nepoužívá jako historická značka na mapě.

## Brand a obrázky

Korálová `#ed483b`, inkoustová `#172337`, krémová `#fff8ee`, šalvějová `#e7eddf`; lokálně servírovaný Manrope Variable. Značka a ikony jsou SVG. Dvě ilustrace vznikly vestavěným imagegen nástrojem; přesné prompty a umístění jsou v [docs/brand.md](docs/brand.md). Nejde o skutečná vozidla ani fotografie konkrétních linek.

## Ověření

```sh
npm test
npm run build
npm run test:browser
npm run format:check
```

Playwright spouští izolovaný mock php-core na portu 4399 a Astro na 4328. Ověřuje kompletní HTTP cestu browser → Astro → provider včetně pevného tenantu a tajného klíče. Pokrývá obnovu vyhledávání, lokální stav detailů bez navigace, příjezd/přímé spoje, GPS obnovu a zamítnutí, mapu, nedostupnost, jazykové URL a mobilní šířku. Mock není důkaz živého spojení s Golemio/Entur. Screenshoty jsou v `test-results/`.

Produkční frontend, host TRAM a dopravní providery musí být nakonfigurovány před veřejným spuštěním. Tento projekt je připraven pro samostatný Node SSR server (`npm run build` + `npm start`); přístupový klíč nepatří do prohlížeče.

## Oblast online hledání

Formulář je pod záložkou **Česká republika** (`country=CZ`). Nad Odkud/Kam je
vyhledávatelný výběr **Město / jízdní řády**, výchozí **Všechny jízdní řády**.
Po připojení formuláře se předem načte online katalog měst z php-core, bez pevného seznamu
Praha/Brno a bez limitu prvních dvaceti zastávek. Psaní filtruje všechny načtené
názvy bez diakritiky. Delší nabídka vykresluje položky postupně po stovkách při
scrollování; klávesnice i filtrování pracují s celým katalogem. Data žijí jen
v otevřeném formuláři: opakované otevření sdílí probíhající požadavek nebo používá
již načtený katalog. Zavření nabídky načítání neruší. Změna státu nebo obnovení
stránky načte katalog znovu online; neúspěšný požadavek lze zopakovat otevřením
nabídky. Názvy se seřadí a normalizují jednou, psaní pouze filtruje připravený
index. Toto znovupoužití statických metadat se netýká polohy ani spojů. Nový endpoint
vyžaduje současné nasazení změn modulu Transport v php-core, bez DB migrace. Stát a vybrané město
se přenášejí do našeptávání i hledání cest. Prázdné město znamená všechna města daného státu. Bez vybraného města našeptávání automaticky požádá o čerstvou GPS a řadí
textové shody podle vzdálenosti, pak textové relevance. GPS nezúží nabídku
na aktuální město; pro zvolený stát zůstávají zapojené všechny dostupné zdroje.
Při odmítnutí nebo nedostupnosti GPS (limit 1,5 sekundy) funguje textové hledání
bez polohy. Výslovné město má přednost a automatickou GPS nepoužívá. GPS našeptávání používá `POST /api/transport/places/` s `q` v těle,
nikdy souřadnice v URL. Backend vybírá všechny relevantní schopné poskytovatele
podle jejich nakonfigurovaného pokrytí; GPS obdélníky nenahrazují přesné hranice
obcí ani globální reverse geocoder.

Lokální český zdroj Spojenka byl ověřen pro `Lazar`, `Grohova`, `Vaclav`,
městské filtry a skutečné spojení v Brně včetně detailu. Používá veřejně popsaný
vývojový server; pro produkci ještě ověřit podmínky, kvóty a dostupnost.
Změna neaktivuje celostátní offline zálohu ani živé polohy pro Spojenku.

Volba „Moje aktuální poloha“ nyní nejprve vybere přes backend nejbližší veřejnou
zastávku (geografická vzdálenost, do 2 km) a plánuje od/k jejímu ID. Nad výsledky
se zobrazí název v `resolvedPlaces`; totéž platí při nulovém počtu spojení.
Časy se vztahují na zastávku, pěší cesta mezi GPS bodem a zastávkou se nepřičítá.
URL zachová `current_location`, takže refresh znovu získá GPS a vybere zastávku.
Bez blízké zastávky UI nabídne ruční výběr. GPS ani odvozený výběr se nepersistuje.

Po úspěšném hledání backend vrací `area.city`; veřejný frontendový provider
jej mapuje na `SearchResult.city`. Společnou obec určuje ze strukturovaných
údajů výchozí a cílové zastávky a kontroluje konce zobrazených úseků v itineráři.
Při chybějících údajích může vrátit `null`; tato hodnota sama o sobě už nemaže
vybrané město. Na Všechny jízdní řády se přepíná pouze při `area.intercity=true`,
které vychází z doložených rozdílných obcí. Automatické doplnění města se provede
jen při dosud prázdném výběru. Nové pole vyžaduje nasazení frontendové i backendové změny.
Není to ověření geometrie trasy ani všech průjezdních zastávek. Výběr i `city`
v URL se upraví přes `replaceState`, bez druhého hledání, bez dalšího GPS fixu
a bez ztráty otevřeného detailu či mapy. Odkazy na dřívější/pozdější spoje
používají upravenou oblast; refresh ji obnoví. Neúspěšné a prázdné hledání
ponechá uživatelův výběr. Ruční změna města vymaže původní výběr zastávek,
aby nové našeptávání pracovalo v požadované oblasti.

V detailu cesty obsahuje označení úseku ikonu příslušné dopravy ze sdílené
sady UIModule. Číslo spoje otevře dialog se všemi jeho zastávkami. Tlačítko
Zastávky mezi odjezdem a příjezdem rozbalí pouze vnitřní zastávky zvoleného
úseku, bez obou koncových zastávek. Výběr používá ID a plánované časy; při
nejednoznačném průjezdu stejnou zastávkou nevypisuje nesouvisející zastávky.
Kliknutí na název koncové zastávky otevře její mapu s pevným bodem. Chybějící
souřadnice se dohledají přes detail zastávky; pokud ani ten polohu neobsahuje,
zobrazí se nedostupnost bez náhradního bodu. Dialogy podporují Escape,
zavření kliknutím na pozadí a návrat fokusu. Detail celé jízdy se už nevypisuje pod úsekem.

Pole Odkud/Kam při focusu označí celý text. Mapové tlačítko je zakázané pro
prázdný nebo pouze rozepsaný vstup; zpřístupní jej vybraná zastávka, aktuální
poloha nebo dříve ručně vybraný bod. Zastávka se otevře podle online detailu,
aktuální GPS se znovu změří a při otevřené mapě sleduje přes `watchPosition`.
Neaktuální poloha se skryje; zavření mapy ukončí sledování. Mapa zastávky/GPS
je pouze náhled, dříve ručně vybraný bod lze nadále upravovat.

Po použití GPS se nabídnou okolní zastávky, seřazené podle geografické
vzdálenosti do 2 km. Výběr je dobrovolný: bez něj zůstává `current_location`,
po výběru se použije veřejné ID zastávky. Nabídka se získává přes
`POST /api/transport/places/` s `q.latitude`, `q.longitude`, `q.observed_at`
a volitelným `q.state`, bez `q.name`. Stejný kontrakt pokračuje na
php-core `POST /transport/v1/places/search`; používá společný
`NearestStopService::search()` se stejným online/fallback principem jako
výběr nejbližší zastávky při plánování. Bez názvu je čerstvá GPS povinná.
Samotná GPS ani čas měření se neukládají do URL či browser storage.

Dialog spoje zobrazuje celou trasu s číslem linky a ikonou v titulku.
Nahoře jsou konkrétní datum jízdy a veřejné číslo linky/spoje; dopravce
a lokalizované poznámky patří pod seznam zastávek. Zde jsou také poskytovatelem
uvedené vlastnosti konkrétního spoje: bezbariérovost, kola, zavazadla, Wi-Fi,
zásuvky, toalety a občerstvení, případně rezervační podmínky. Chybějící příznak
neznamená zákaz ani potvrzení dostupnosti. Jde o plánované vybavení, nikoli
ověření právě vypraveného vozidla. Technické poznámky typu Grafikony jsou
zachované v rozbalitelných podrobnostech; jejich interní kódy nedekódujeme
na nepodložené dny provozu. Rozlišuje poznámky linky a spoje. Text dodavatele se escapuje,
webové odkazy povolují pouze HTTP(S), kontaktní telefon pouze platné `tel:`.
Dostupnost jednotlivých údajů závisí na zdroji: aktuální detail Spojenky
neposkytuje strukturované kontakty dopravce ani opakující se provozní kalendář.
Konkrétní datum jízdy se proto nezobrazuje jako tvrzení „jede v pracovní dny“.
Garantované návaznosti lze zobrazit jako poznámku, pouze pokud ji API dodá;
neodvozují se z časové blízkosti spojů. Identifikátory registrů PTI ani interní
ID se nezobrazují jako veřejné číslo spoje.

Zastávky v dialogu mají volitelné údaje `tariffZones` (s identitou tarifního
systému), `requestStop` a `routeKm`. Je-li zóna nebo kilometráž dostupná,
zobrazí se samostatné sloupce Čas / Zastávka / Zóna / Km trasy. Značka `z`
s vysvětlivkou znamená zastávku na znamení a není součástí čísla zóny.
Kilometráž je přímo údaj poskytovatele (`kmPosition` u Spojenky), nikoli
vzdušná vzdálenost či rozdíl vůči předchozí zastávce. Zobrazení používá
nejvýše tři desetinná místa bez doplňování nul; nedostupné údaje jsou `—`,
pokud chybí zóny i kilometráž, přídavné sloupce se nezobrazují. Mezilehlé zastávky zachovávají původní
kilometráž celé jízdy. U ověřeného spoje 35/1093 Spojenka dodává celé km
0, 0, 1, 1, 1, 2, 3; přesnější čísla z IDOS tím nezískáváme.

Sdílené komponenty `UIModule/Dialog` a `UIModule/Collapse` spravují přechody,
fokus a rozbalování. Dialog zavírá Escape, křížek nebo kliknutí na pozadí;
tažení z obsahu ven jej nezavře. Animace respektují `prefers-reduced-motion`.
Barevné badge spoje otevírají stejný detail z přehledu i z rozbalené cesty.
Načtené mezilehlé zastávky zůstávají při otevření jejich detailu zachované.
Mapy mají vyhrazenou výšku během načítání; zoom nastavuje `config/client.ts`.

### Živé sledování a zpoždění

Jedna zobrazená stránka používá **jeden společný WebSocket** pro všechny
jedinečné spoje v otevřených accordionech a dialogu. Každý spoj získá vlastní
jednorázový ticket přes `POST /api/transport/tracking/`, ale `subscribe`
přidá nebo obnoví odběr na stejném spojení; `unsubscribe` s `trip` jej odebere.
Obnova oprávnění po 14,5 minutách nepřipojuje další socket. Fronta ticketů
zachovává společný odstup a cooldown při 429. Výpadek obnoví jednu transportní
relaci a vydá nové tickety pro požadované spoje. Zavření posledního odběru,
skrytí stránky nebo odchod ze stránky socket odpojí. Java gateway musí
podporovat více `subscribe` na jednom spojení; aktualizujte ji spolu s frontendem.

Otevřený detail spojení odebírá aktuální pozorování přes `useTripTracking` a společný `RealtimeModule`. BFF `POST /api/transport/tracking/` vydává pouze krátkodobý ticket; klíče poskytovatelů zůstávají v php-core. Je potřeba samostatně nakonfigurovat a spustit backendovou gateway podle [provozní dokumentace](../../php/php-core/docs/tram-realtime-tracking.md). Bez dostupného živého odběru zůstává statický detail; první umístění červeného bodu vyžaduje ověřenou GPS. Vedle živého měření (do 30 sekund) umí přijmout explicitní `last_known` (do 90 sekund), s původním časem a označením poslední známé polohy. Taková poloha neovlivňuje časy, zpoždění ani návaznosti.

`trackedJourney` společně přepočítává časy, délku cesty, chůzi a návaznosti. Badge je vedle označení spoje: kladné zpoždění červeně, nulové i dosud neznámé zpoždění zeleně „Bez zpoždění“ podle požadovaného UI. Neznámá hodnota zůstává ve výpočtech `null`, není potvrzením včasného příjezdu. `useDelayStatus` ponechá poslední potvrzenou hodnotu po dobu zobrazení komponenty i mezi aktualizacemi; tooltip a přístupný popisek označí neaktuální údaj. Tato paměť slouží pouze badge, ne výpočtu trasy. GPS a časové predikce nadále expirují původním timerem. Časy zastávek se zobrazují bez pomocné značky odhadu. Zavření detailu/skrytí stránky odpojí odběry, žádná poloha se neukládá do storage ani URL. Současný pohyb vozidla automaticky nevytváří náhradní trasu: při ohroženém přestupu UI vyzve k novému vyhledání.

Detail spoje používá `TripTimeline` s osou vlevo od časů a bodem u každé zastávky. `tripProgress` promítá čerstvou GPS a `lastKnownTripProgress` odděleně poslední známé měření na jednoznačný úsek mezi sousedními zastávkami; bod mezi nimi vyjadřuje přibližný postup na schematické ose, nikoli odhad polohy podle hodin. Chybějící souřadnice, nejednoznačné smyčky nebo bod mimo trasu se nepřemosťují. Limity projekce jsou v `TransportModule/config/client.ts`. `useTripTimeline` měří skutečné výšky řádků i po změně šířky a při zalomení názvů. Před prvním ověřeným měřením zůstává osa bez červeného bodu. Poslední známá poloha je viditelně označená a po dobu otevřeného dialogu zůstane na posledním jednoznačném místě. Živá mapa ani hláška o nedostupné poloze nejsou součástí dialogu; mapy zastávek a trasy zůstávají dostupné.

Badge zpoždění každého úseku umí využít samostatnou čerstvou zastávkovou predikci nebo číselné zpoždění i tehdy, když GPS poskytovatel nemá. Neznámé zpoždění se pro výpočty nikdy nepřevádí na potvrzenou nulu. Brněnské Spojenka/CIS spoje mohou využít backendový adaptér IDS JMK, pokud je zapnutý pro tenant. Aktuální preset pokrývá CIS linky 737001–737099 a 738001–738099 a ověřuje konkrétní dnešní jízdu. Původní trip ID i frontendový kontrakt zůstávají stejné; React nezná konkrétního poskytovatele. Bez čerstvého měření se dříve zobrazený bod ponechá jako poslední známá poloha; potvrzené nulové zpoždění zobrazí zelený badge. Konfigurace a omezení jsou v provozní dokumentaci výše.

Při nejednoznačném přiřazení, načítání, výpadku nebo expiraci GPS ponechá `useTripProgress` poslední jednoznačně určený bod stejného spoje. Tooltip a přístupný popisek jej označí jako poslední známou polohu; nová platná GPS jej znovu aktualizuje. Uchovává se pouze index úseku a poměr na ose v paměti otevřeného dialogu, nikoliv GPS v databázi či storage. Při změně spoje nebo zavření dialogu se tato paměť uvolní. Časy a výpočty nadále využívají jen platné predikce. Bez jediného ověřeného bodu nelze polohu na ose zobrazit.

Při každém otevření dialogu zavolá `useTripTracking` také
`GET /api/transport/observation/?id=…` přes serverový provider a existující
php-core endpoint `/transport/v1/trips/:id/observation`. První poloha se tedy
načítá souběžně se statickým detailem a socketem, bez čekání na jeho zprávu
nebo frontu ticketů. Otevření již sledovaného spoje obnoví pozorování bez
odpojení socketu. Odpověď má `no-store`; původní časy měření a expirace se
nemění. Pomalejší HTTP odpověď nesmí přepsat novější zprávu ze socketu a
zavření neodebíraného spoje probíhající načtení zruší. Data zůstávají jen v RAM.

### Stabilní výsledky při živých aktualizacích

Výsledky hledání jsou po načtení neměnný podklad. `TransportView` neposouvá,
nepřerovnává ani neodstraňuje karty podle WebSocketu a nemá sekundový timer
překreslující celý strom. Accordiony a dialogy ovládá lokální React stav.
`useTripTracking` zapisuje jen pozorování do paměťového `trackingStore`.
`useSyncExternalStore` odebírají malé komponenty: časy úseků a zastávek,
badge, délka cesty, upozornění na návaznost a ukazatele GPS. Přepočet
`trackedJourney` je pouze projekce časů pro tyto komponenty; seznam zastávek,
legendy, názvy i načtené detaily nemění a nic znovu nestahuje.

Ztráta čerstvé GPS ponechá poslední známý marker na místě. Časy používají stejně široké číslice a badge mají stálou minimální šířku. Nepotřebné hlášky, prázdné legendy, zavřené nabídky a uzavřené accordiony se nevykreslují. Dialog ponechá obsah jen během zavírací animace.
Test v prohlížeči posílá opakované změny zpoždění i výpadek dat a kontroluje
pořadí karet, totožnost DOM uzlů, výšku accordionu, scroll dialogu a počet HTTP
načtení detailu. Nové pořadí výsledků vzniká až novým vyhledáním uživatele.

Lokální stav uchovává otevřené karty a kontext zvoleného dialogu nebo mapy.
Staré odkazy s detailem obnoví pouze vyhledání, nikoliv otevřené karty.
Datum a badge linek jsou první částí viditelné hlavičky accordionu i při sbalení. Tlačítka badge a odkaz pro rozbalení jsou sourozenci uvnitř `.journey-summary`; kliknutí na badge otevře pouze dialog a zachová stav rozbalení. Dialog má přichycenou hlavičku s titulkem, badge zpoždění a zavíracím tlačítkem; opakované štítky plánovaných/online časů se nezobrazují.
`TripResources` sdílí načtené statické detaily a probíhající požadavky uvnitř
otevřeného vyhledávače. Opětovné otevření statického detailu je bez dalšího HTTP požadavku; první
otevření dosud nenačteného spoje zobrazí hlavičku a stav načítání zastávek.
WebSocket běží nezávisle a aktualizuje pouze malé živé komponenty.

Po načtení nových výsledků `useScrollOnContent` plynule posune stránku k jejich záhlaví. Respektuje omezení animací a nepřesouvá stránku při změnách accordionů, dialogů ani živých údajů.

Statické detaily se načítají na vyžádání, nikoliv hromadně pro všechny výsledky.
`tripResources` slučuje stejné požadavky a omezuje síť na dva souběžné požadavky.
Detail se sdílí mezi dialogem a mezilehlými zastávkami po celou dobu otevřeného
vyhledávače; nové otevření už načteného spoje nevolá další HTTP požadavek.
BFF načítá základní detail s `stop_coordinates=0`: Spojenka tak nečeká na
jednotlivé dotazy pro souřadnice. Teprve otevřená časová osa s chybějícími
souřadnicemi spustí oddělené `GET /api/transport/trip/?id=...&coordinates=1`.
`useTripCoordinates` převezme pouze souřadnice shodných zastávkových výskytů;
původní statické řádky, názvy, časy a legendy nenahradí. Mapa zastávky má
nadále vlastní dohledání polohy. Rychlé zobrazení vyžaduje také odpovídající
verzi php-core s podporou `stop_coordinates`.

`trackingSubscriptions` zachovává odběry při změně otevřených karet; zavřený
accordion s otevřeným dialogem sleduje pouze konkrétní spoj. Úspěšný ticket
je jednorázový: nové připojení i opětovné otevření po odpojení žádá nový.
Obnova socketu používá omezené prodlevy 1–30 sekund, nikoli opakované
použití ticketu. V paměti se uchovávají pouze nedostupné stavy, nikdy
ticket v URL/storage. Nové tikety vydává
postupně (nejvýše jeden začátek požadavku za sekundu); 429 pozastaví celou
frontu podle `Retry-After`, nebo na 60 sekund při chybějící hlavičce.
BFF tuto hlavičku přenáší z php-core. Limity backendu se nezvyšují.

Čas poslední zastávky plného detailu je příjezd, i když zdroj uvádí také pozdější odjezd (například po pobytu na konečné). Mezilehlé zastávky zobrazují odjezd; výřez mezilehlých zastávek zachovává jejich místo v celém spoji. Pobyt na konečné se nepřičítá k jízdě předchozího úseku.
