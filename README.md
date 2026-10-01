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

- `PUBLIC_SITE_URL`: skutečný origin webu (shodný s originem POST požadavků).
- `PHP_CORE_URL`: kořen php-core API včetně `/api`, bez `/transport/v1`.
- `PHP_CORE_API_KEY`: interní klíč backendu, pouze na serveru.
- `PHP_CORE_TENANT_HOST`: pevný host mapovaný v php-core na `tram`, např. `tram.localhost`.

Backend musí mít aplikované `schema.sql`, `tram_schema.sql`, `tram_seed.sql`, host ve `FRANCHISE_CODES` a nakonfigurované skutečné providery přes `transport-configure.php`. Samotná DB migrace poskytovatele nezapíná. Pokud backend nemá žádný zdroj pro zvolenou oblast (`sources: []`), našeptávač zobrazí chybějící připojení dat; nejde o úspěšné hledání bez nalezených zastávek. PID vyžaduje Golemio token; OTP fallback vyžaduje hotový graf. Entur pokrývá Norsko. Dosavadní PID online plánování umí jen přímé spojení nebo jeden přestup mezi přesnými zastávkami; GPS a ruční mapový bod mohou u tohoto zdroje vrátit nepodporovanou schopnost. Frontend toto omezení zobrazuje.

## Struktura

- `src/config/site.ts`, `routes.ts`: brand, aktivní moduly a jazykové URL.
- `LandingModule`: intro, vysvětlení, ilustrace, FAQ.
- `TransportModule`: formulář, URL stav, našeptávač, výsledky, detail, mapa, serverový provider a HTTP handlery.
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
  Formulář se zpřístupní po hydrataci, aby neztratil první vstup uživatele.
- `useJourneySearch` vlastní online hledání, chyby a opakování dotazu;
  `useTrip` načítá detail pouze pro otevřený pohled. Výsledky se neukládají do
  browser storage. `TransportModule/config/client.ts` obsahuje klientské limity,
  výchozí města, středy map a BFF endpointy.
- `JourneyResults`, `TripStops` a `TripLegend` jsou React komponenty. Poznámky
  poskytovatelů se vykreslují jako text a odkazy mají kontrolovaný protokol.
- `UrlNavigationProvider` a `NavLink` z UIModule obsluhují URL a historii;
  zavření dialogů zachovává výběr a vrací fokus. URL zůstává zdrojem navigačního stavu.
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

URL nese identitu a popis obou míst, čas jako RFC3339, příjezd/odjezd, přímé spojení a oblast. `journey` identifikuje rozkliknuté spojení, `leg` dialog všech zastávek spoje, `stops` rozbalené mezilehlé zastávky úseku a `map` výběr počátku/cíle, mapu trasy nebo zastávky. Pro `map=stop` označují `stopLeg` a `stopSide` konkrétní konec úseku. Při otevření mapy ze seznamu zastávek v dialogu zůstává `leg` zachovaný a `tripStop` určuje pořadí zastávky v celém spoji. Stejnou mapu otevírají i mezilehlé zastávky v accordionu: `stopLeg` určuje úsek a `tripStop` původní pořadí v celém spoji, `stops` zachovává rozbalený seznam. Mapa se z dialogu otevírá nad detailem spoje; zavření vrací fokus na danou zastávku. Funguje refresh, přímé otevření odkazu a Zpět/Vpřed.

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

Playwright spouští izolovaný mock php-core na portu 4399 a Astro na 4328. Ověřuje kompletní HTTP cestu browser → Astro → provider včetně pevného tenantu a tajného klíče. Pokrývá refresh detailu, historii, příjezd/přímé spoje, GPS obnovu a zamítnutí, mapu, nedostupnost, jazykové URL a mobilní šířku. Mock není důkaz živého spojení s Golemio/Entur. Screenshoty jsou v `test-results/`.

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
Zpět/Vpřed i refresh URL. Detail celé jízdy se už nevypisuje pod úsekem.

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

Otevřený detail spojení odebírá aktuální pozorování přes `useTripTracking` a společný `RealtimeModule`. BFF `POST /api/transport/tracking/` vydává pouze krátkodobý ticket; klíče poskytovatelů zůstávají v php-core. Je potřeba samostatně nakonfigurovat a spustit backendovou gateway podle [provozní dokumentace](../../php/php-core/docs/tram-realtime-tracking.md). Bez gateway se zobrazí nedostupnost, u nepodporovaného zdroje explicitní informace.

`trackedJourney` společně přepočítává časy, délku cesty, chůzi a návaznosti. Živý badge je jen pro kladné zpoždění, zastávkové odhady mají `≈`. Zastaralá měření odstraní lokální timer i bez další síťové odpovědi. Zavření detailu/skrytí stránky odpojí odběry, žádná poloha se neukládá do storage ani URL. Současný pohyb vozidla automaticky nevytváří náhradní trasu: při ohroženém přestupu UI vyzve k novému vyhledání.

Detail spoje používá `TripTimeline` s osou vlevo od časů a bodem u každé zastávky. `tripProgress` promítá pouze čerstvou GPS na jednoznačný úsek mezi sousedními zastávkami; bod mezi nimi vyjadřuje přibližný postup na schematické ose, nikoli odhad polohy podle hodin. Chybějící souřadnice, nejednoznačné smyčky nebo bod mimo trasu se nepřemosťují. Limity projekce jsou v `TransportModule/config/client.ts`. `useTripTimeline` měří skutečné výšky řádků i po změně šířky a při zalomení názvů. Bez GPS zůstává osa bez červeného bodu; aktuální mapa je nad výpisem.

Badge zpoždění každého úseku umí využít samostatnou čerstvou zastávkovou predikci nebo číselné zpoždění i tehdy, když GPS poskytovatel nemá. Neznámé, nulové a záporné zpoždění badge nevytváří. Brněnské spoje ze současného Spojenka adaptéru bez napojeného GPS zdroje zůstávají ve stavu `unsupported`; tato úprava UI nepřidává nový adaptér IDS JMK.

Při nejednoznačném přiřazení nové GPS ponechá `useTripProgress` poslední jednoznačný bod stejného spoje s označením „Poslední jednoznačná poloha na trase“. Platnost se řídí původním měřením a nová nejednoznačná data ji neprodlužují. Po vypršení, ztrátě živého odběru, zrušení spoje nebo změně detailu se bod odstraní; stav je pouze v paměti otevřeného dialogu.
