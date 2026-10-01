import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TripLegend, {
  LinkedNote,
} from "../src/modules/TransportJourneyModule/components/TripLegend";
import type { Dictionary } from "../src/modules/TransportCoreModule/providers/translations";
const renderTripLegend = (
  trip: Trip,
  leg: Leg,
  t: Dictionary,
  locale: string,
) => renderToStaticMarkup(createElement(TripLegend, { trip, leg, t, locale }));
const linkedNote = (text: string) =>
  renderToStaticMarkup(createElement(LinkedNote, { text }));
import test from "node:test";
import assert from "node:assert/strict";
import { safeWebUrl } from "../src/modules/TransportJourneyModule/providers/tripLegend";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import type { Leg, Trip } from "../src/modules/TransportCoreModule/types";
const leg = { operator: "", line: "35" } as Leg;
const trip: Trip = {
  sourceMode: "live",
  stops: ["A", "B"].map((name) => ({
    stop: { id: name, name, lat: null, lon: null, platform: null },
    arrival: null,
    departure: null,
  })),
  metadata: {
    line: "35",
    number: "1093",
    name: null,
    serviceDate: "2026-10-06",
    operator: null,
    notes: [
      {
        scope: "trip",
        texts: { cs: "Česká poznámka", en: "English note" },
        defaultLanguage: "cs",
      },
    ],
  },
};
test("trip legend uses service metadata and localized notes without inventing calendars or contacts", () => {
  const html = renderTripLegend(trip, leg, dictionary("en"), "en");
  assert.match(html, /35\/1093/);
  assert.match(html, /English note/);
  assert.match(html, /Service date/);
  assert.doesNotMatch(html, /Česká|Dopravní podnik|jede v X/);
  const minimal = renderTripLegend(
    { ...trip, metadata: undefined },
    leg,
    dictionary("cs"),
    "cs",
  );
  assert.equal(minimal, "");
  assert.doesNotMatch(minimal, /1093|Datum spoje|Poznámka/);
});
test("provider notes remain plain text with safe links and no executable HTML", () => {
  const html = linkedNote("<img src=x onerror=alert(1)> Tarif www.idsjmk.cz.");
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /href="https:\/\/www.idsjmk.cz\/"/);
  assert.equal(safeWebUrl("javascript:alert(1)"), null);
  assert.equal(safeWebUrl("https://user:secret@example.test"), null);
  assert.equal(safeWebUrl("data:text/html,<script>"), null);
});
test("line and trip notes are deduplicated and operator links use safe protocols only", () => {
  const enriched: Trip = {
    ...trip,
    metadata: {
      ...trip.metadata!,
      operator: {
        name: "<Operator>",
        city: "Brno",
        url: "javascript:alert(1)",
        phone: "+420 123 456 789",
      },
      notes: [trip.metadata!.notes[0], trip.metadata!.notes[0]],
    },
  };
  const html = renderTripLegend(enriched, leg, dictionary("cs"), "cs");
  assert.equal(html.split("Česká poznámka").length - 1, 1);
  assert.match(html, /&lt;Operator&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /href="tel:\+420123456789"/);
});

test("trip equipment and reservations are visible while technical notes are collapsed", () => {
  const enriched: Trip = {
    ...trip,
    metadata: {
      ...trip.metadata!,
      accessibility: "accessible",
      features: ["BICYCLE_TRANSPORT", "WIFI", "TOILETS", "SOCKETS_230V"],
      reservations: { bicycle: "mandatory" },
      notes: [
        ...trip.metadata!.notes,
        {
          scope: "line",
          category: "technical",
          texts: { cs: "Grafikony: PD: T2610 SN: T2609 Pz: P2610" },
          defaultLanguage: "cs",
        },
      ],
    },
  };
  const html = renderTripLegend(enriched, leg, dictionary("cs"), "cs");
  assert.match(html, /Bezbariérové vozidlo podle jízdního řádu/);
  assert.match(html, /Přeprava jízdních kol/);
  assert.match(html, /Rezervace pro kolo/);
  assert.match(html, /Povinná/);
  assert.match(html, /data-mode="wheelchair"/);
  assert.match(html, /data-mode="bicycle"/);
  assert.match(html, /<details class="trip-technical-notes"><summary>/);
  assert.doesNotMatch(html, /<details[^>]*open/);
  assert.match(html, /Grafikony: PD: T2610/);
  const summary = renderToStaticMarkup(
    createElement(TripLegend, {
      trip: enriched,
      leg,
      t: dictionary("cs"),
      locale: "cs",
      section: "summary",
    }),
  );
  assert.doesNotMatch(summary, /Přeprava jízdních kol|Grafikony|Wi-Fi/);
});
