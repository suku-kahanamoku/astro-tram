import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TripStops from "../src/modules/TransportModule/components/TripStops";
import type { Dictionary } from "../src/modules/TransportModule/providers/translations";
const renderTrip = (trip: Trip, t: Dictionary, locale: string, leg?: Leg) =>
  renderToStaticMarkup(createElement(TripStops, { trip, t, locale, leg }));
import test from "node:test";
import assert from "node:assert/strict";
import { intermediateStops } from "../src/modules/TransportModule/providers/trip";
import type { Leg, Trip, TripStop } from "../src/modules/TransportModule/types";
const call = (id: string, clock: string): TripStop => ({
  stop: { id, name: id, lat: null, lon: null, platform: null },
  arrival: `2026-10-01T${clock}:00Z`,
  departure: `2026-10-01T${clock}:00Z`,
});
const calls = [
  call("X", "00:00"),
  call("A", "00:05"),
  call("B", "00:10"),
  call("A", "00:15"),
  call("C", "00:20"),
  call("D", "00:25"),
  call("Y", "00:30"),
];
const trip: Trip = { sourceMode: "live", stops: calls };
const leg = {
  from: calls[3].stop,
  to: calls[5].stop,
  scheduledDeparture: calls[3].departure,
  scheduledArrival: calls[5].arrival,
} as Leg;
test("intermediate stops use the correct occurrence of a repeated stop and exclude endpoints", () => {
  assert.deepEqual(intermediateStops(trip, leg), [calls[4]]);
});
test("ambiguous, reversed and missing boundaries never display an unrelated full trip", () => {
  assert.equal(
    intermediateStops(trip, {
      ...leg,
      scheduledDeparture: "2026-10-01T00:01:00Z",
    }),
    null,
  );
  assert.equal(intermediateStops(trip, { ...leg, from: calls[6].stop }), null);
  assert.equal(
    intermediateStops(trip, { ...leg, from: { ...leg.from, id: null } }),
    null,
  );
});
test("direct adjacent calls have no intermediate stops and unique boundaries tolerate missing times", () => {
  assert.deepEqual(
    intermediateStops(trip, { ...leg, from: calls[4].stop }),
    [],
  );
  const noTimes = {
    ...trip,
    stops: trip.stops.map((c) => ({ ...c, arrival: null, departure: null })),
  };
  assert.deepEqual(
    intermediateStops(noTimes, { ...leg, from: calls[4].stop }),
    [],
  );
});

test("stop rows show zones separately from request-stop marks and preserve source precision", async () => {
  const { dictionary } =
    await import("../src/modules/TransportModule/providers/translations");
  const enriched: Trip = {
    ...trip,
    stops: [
      {
        ...calls[0],
        tariffZones: [
          { system: "IDSJMK", zone: "100" },
          { system: "OTHER", zone: "<A>" },
        ],
        requestStop: true,
        routeKm: 0,
      },
      { ...calls[1], routeKm: 1.227 },
      { ...calls[2], routeKm: null },
    ],
  };
  const html = renderTrip(enriched, dictionary("cs"), "cs");
  assert.match(html, /request-stop/);
  assert.match(html, /IDSJMK · 100/);
  assert.match(html, /&lt;A&gt;/);
  assert.match(html, /1,227 km/);
  assert.match(html, /0 km/);
  assert.doesNotMatch(html, /0,000/);
  const unknown = renderTrip(
    { ...trip, stops: [calls[0]] },
    dictionary("cs"),
    "cs",
  );
  assert.doesNotMatch(unknown, /trip-stop-km|request-stop|trip-stop-zones/);
});

test("full trip highlights boarding, intermediate and alighting calls only at the matching occurrence", async () => {
  const { dictionary } =
    await import("../src/modules/TransportModule/providers/translations");
  const html = renderTrip(trip, dictionary("cs"), "cs", leg);
  const rows = [
    ...html.matchAll(
      /<li class="([^"]*)">.*?<span class="trip-stop-name">([^<]*)/g,
    ),
  ];
  assert.deepEqual(
    rows.filter((r) => r[1].includes("is-selected-segment")).map((r) => r[2]),
    ["A", "C", "D"],
  );
  assert.equal(rows[1][1].includes("is-selected-segment"), false);
  const ambiguous = renderTrip(trip, dictionary("cs"), "cs", {
    ...leg,
    scheduledDeparture: "2026-10-01T00:01:00Z",
  });
  assert.doesNotMatch(ambiguous, /is-selected-segment/);
});
