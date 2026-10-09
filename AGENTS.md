# Astro TRAM

- Měňte pouze tento projekt, pokud není výslovně zadáno jinak.
- Značka a zapnutí modulů patří do `src/config/site.ts`, reklamní jednotky do `src/config/ads.ts`, trasy do `src/config/routes.ts`.
- Texty UI udržujte v `src/modules/<Name>Module/locales/{cs,en,de}.json`; všechny jazyky používají stejné komponenty a helper `url()`.
- Dopravní kontrakty ověřte v `../../java-tram/OTP/API.md` a skutečné Java implementaci; přihlášení/administraci v `../../php/php-core/API.md`. Nepředpokládejte dostupnost nového endpointu ani WebSocket serveru.
- Dopravní komunikace vede přímo na Java API přes `CoreModule/server/java-tram.ts`; nesmí se vracet k PHP gateway. Přihlášení a přepínač online plánovačů používají php-core přes `src/modules/CoreModule/server/php-core.ts` a modulový serverový provider. Žádný otevřený proxy endpoint.
- `PHP_CORE_API_KEY`, pevný tenant a uživatelský Bearer patří pouze do serverové vrstvy. Nikdy nepřebírejte klientské `X-Forwarded-Host`, API klíč či role jako důvěryhodné údaje.
- Provider mapuje odpověď backendu; veřejná API vrstva vrací jen záměrně vybraná pole. Autorizaci nad daty vždy ověřuje php-core.
- Nové mutace musí projít kontrolou originu, validací vstupu a limity velikosti. Soukromé odpovědi nejsou cacheovatelné.
- Reklamní skripty načítejte až po signálu projektové CMP a pouze pro viditelné sloty.
- Klientské interakce implementujte jako React komponenty a hooky v existujících modulech. Astro sestavuje stránky a serverovou vrstvu; čisté TypeScript providery, validace a síťové adaptéry zůstávají oddělené od UI. Nepřidávejte DOM inicializátory ani vykreslování HTML přes řetězce. OpenLayers a externí SDK smí spravovat pouze vlastní podstrom předaný přes ref.
- Spusťte `npm test`, `npm run build`, `npm run format:check`; při změně layoutu nebo auth také `npm run test:browser`.
- Oddělujte ověření mockem, prohlížečem a skutečným backendem. Aktualizujte README při změně kontraktu nebo konfigurace.

- Moduly používají název `<Name>Module` a vlastní potřebné `assets`, `locales`, `hooks`, `components`, `providers`, `server`, `styles` a `config`. Nezakládejte prázdné složky ani modulové `pages`; sekce se skládají v hlavním `src/pages`.
- UIModule, CoreModule a RealtimeModule jsou nezávislé základy. LangModule může používat UI; ostatní moduly sdílejí UI, Lang a případně Core bez vzájemných importů doménových modulů. Povolené hranice a cykly hlídá `tests/architecture.test.ts`.
- UIModule vlastní theme. LangModule vlastní výčet jazyků, vlajky a locale helpery; modulové slovníky se neslévají do globálního registru. Menu dostává texty/odkazy přes props, jazykový přepínač tvorbu URL přes `href`.
- Browser hooky a providery nesmějí tranzitivně importovat serverovou logiku. Kompozice serverových providerů zůstává v `src/server/providers.ts`; API routy exportují handlery z `server/` příslušného modulu.

## graphify

The project code graph is at `graphify-out/graph.json`. It is a navigation aid; verify findings in the source files. Graphify may parse `.astro` components only partially, so inspect the relevant `.astro` templates directly after locating them through the graph.

- When the user types `$graphify`, use the installed Graphify skill.
- For every codebase task, start from this project's root and use a targeted `graphify query "<question>"`. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. Inspect only relevant source files identified by the graph. Do not scan, list, or read all project files to discover the structure. If the query misses, refine it with code symbols or use a narrowly scoped search.
- If code may have changed since the graph was built, run `graphify update .` before relying on graph results. After every completed code change, including additions, deletions, and renames, run `graphify update .` before another graph query or the final response. Do not leave changed code with a stale graph.
- Generated files in `graphify-out/` may change after updates; this is expected. If `graphify-out/wiki/index.md` exists, use it for broad navigation. Read `graphify-out/GRAPH_REPORT.md` for broad architecture review or when targeted queries are insufficient.
- If the task concerns a wrong or stale graph, diagnose the graph against source files. If the user explicitly asks not to use Graphify, follow that request.

## Nabídka měst pro všechny země

- Pořadí měst určuje společná Java Places politika: regionální centrum kraje
  aktuální GPS, ostatní regionální centra abecedně, ostatní města abecedně.
  React zachovává pořadí API i při textovém filtrování; nevytvářej vlastní seznam
  center ani nepřerovnávej nabídku podle české abecedy pro každý stát.
- Výslovná země je pevný filtr. „Všechny jízdní řády“ zůstává první ovládací
  možností. Bez GPS se řadí všechna doložená centra před ostatními městy.
- GPS pro cities se předává pouze privátním POST tělem, nikdy v URL nebo cache.
  Statický katalog načti ihned, při prvním otevření jej jednou upřesni dostupnou GPS; další focus
  nesmí opakovat žádný z těchto požadavků. Nedostupná GPS neblokuje katalog.
- Nový stát/zdroj vyžaduje odpovídající správní metadata v Java importu
  (`administrative_levels`, `city_ranking.locale`, `regional_capital`,
  `capital_regions`) a nový Places index. Přidání státu nesmí vyžadovat
  další větvení nebo seznam měst v Reactu. Nezaměňuj hlavní a krajské město.
