import type { DataAttribution } from "../../TransportCoreModule/types";

/** Downloaded standalone feed; the active CZ graph currently uses Spojenka. */
export const supplementaryGtfsLicenses: DataAttribution[] = [
  {
    id: "gtfs:idsjmk:idsjmk",
    feed_id: "idsjmk",
    name: "IDS JMK GTFS — CC BY 4.0",
    attribution: "KORDIS JMK, a.s. — jízdní řády IDS JMK; CC BY 4.0.",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    source_url: "https://portal.idsjmk.cz/a/kontakty.html",
    published_at: null,
    updated_at: null,
    requirements: [],
  },
];

/**
 * Reviewed supplementary services in the Java Cloudflare CZ/DE configuration.
 * The graph manifest currently exposes static GTFS/OSM only. Keep this small
 * disclosure registry in sync when realtime adapters change; it does not grant
 * permission or automatically claim every configured adapter is active.
 */
export const supplementaryDataLicenses: DataAttribution[] = [
  {
    id: "realtime:pid-golemio",
    feed_id: null,
    name: "PID / Golemio — podmínky Open Data API",
    attribution:
      "ROPID / Pražská integrovaná doprava / Operátor ICT — polohy vozidel a zpoždění PID. Identifikátory spojů jsou převedené do GTFS aplikace Trambus; živá měření se neukládají. Licence odkazovaných API se řídí podmínkami daného zdroje.",
    license_url: "https://pid.cz/o-systemu/opendata/",
    source_url: "https://api.golemio.cz/pid/docs/openapi/",
    published_at: null,
    updated_at: null,
    requirements: [],
  },
  {
    id: "realtime:idsjmk-gtfs",
    feed_id: null,
    name: "IDS JMK GTFS-Realtime — CC BY 4.0",
    attribution: "KORDIS JMK, a.s. — IDS JMK, GTFS-Realtime.",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    source_url: "https://www.idsjmk.cz/a/kontakty.html",
    published_at: null,
    updated_at: null,
    requirements: [],
  },
  {
    id: "realtime:idsjmk-traffic",
    feed_id: null,
    name: "IDS JMK traffic-state — NonCommercial / API permission unverified",
    attribution:
      "KORDIS JMK, a.s. — IDS JMK, traffic-state JSON API. Web uvádí CC BY-NC-SA 4.0, není-li uvedeno jinak; samostatné oprávnění k použití JSON API na webu s reklamou není doloženo. Výslovná CC BY 4.0 licence GTFS se na jiné API automaticky nevztahuje.",
    license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    source_url: "https://www.idsjmk.cz/traffic-state/links",
    published_at: null,
    updated_at: null,
    requirements: [],
  },
  {
    id: "realtime:vbb",
    feed_id: null,
    name: "VBB GTFS-Realtime — CC BY 4.0",
    attribution:
      "Verkehrsverbund Berlin-Brandenburg GmbH (VBB), GTFS-Realtime, CC BY 4.0.",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    source_url: "https://production.gtfsrt.vbb.de/",
    published_at: null,
    updated_at: null,
    requirements: [],
  },
];
