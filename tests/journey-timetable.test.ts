import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  JourneyTime,
  JourneyDate,
  JourneyDuration,
  TripCallTime,
} from "../src/modules/TransportJourneyModule/components/JourneyLiveFields";
import {
  scheduledDuration,
  time,
  date,
} from "../src/modules/TransportJourneyModule/providers/render";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import type {
  Journey,
  Leg,
  TripStop,
} from "../src/modules/TransportCoreModule/types";

const leg = {
  scheduledDeparture: "2026-10-01T21:55:00Z",
  scheduledArrival: "2026-10-01T22:10:00Z",
  expectedDeparture: "2026-10-01T22:05:00Z",
  expectedArrival: "2026-10-01T22:20:00Z",
  realtime: true,
  predictionValidUntil: "2099-01-01T00:00:00Z",
} as Leg;
const journey = { legs: [leg], duration: 1800, transfers: 0 } as Journey;

test("journey times, date and duration always display the timetable even when initial predictions differ", () => {
  for (const event of ["departure", "arrival"] as const) {
    const scheduled =
      event === "departure" ? leg.scheduledDeparture : leg.scheduledArrival;
    const html = renderToStaticMarkup(
      createElement(JourneyTime, { journey, index: 0, event, locale: "cs" }),
    );
    assert.ok(html.includes(`dateTime="${scheduled}"`));
    assert.ok(html.includes(`>${time(scheduled, "cs")}</time>`));
  }
  const day = renderToStaticMarkup(
    createElement(JourneyDate, { journey, locale: "cs" }),
  );
  assert.ok(day.includes(date(leg.scheduledDeparture, "cs")));
  assert.equal(scheduledDuration(journey), 900);
  const duration = renderToStaticMarkup(
    createElement(JourneyDuration, { journey, t: dictionary("cs") }),
  );
  assert.ok(duration.includes("15 min"));
  assert.ok(!duration.includes("30 min"));
});

test("intermediate and terminal calls display scheduled departures and arrivals without predictions", () => {
  const call = {
    departure: "2026-10-01T22:15:00Z",
    arrival: "2026-10-01T22:10:00Z",
    expectedDeparture: "2026-10-01T22:25:00Z",
    expectedArrival: "2026-10-01T22:20:00Z",
    predictionValidUntil: "2099-01-01T00:00:00Z",
  } as TripStop;
  for (const event of ["departure", "arrival"] as const) {
    const html = renderToStaticMarkup(
      createElement(TripCallTime, { call, event, locale: "cs" }),
    );
    assert.ok(html.includes(`>${time(call[event]!, "cs")}</time>`));
  }
  const fallback = renderToStaticMarkup(
    createElement(TripCallTime, {
      call: { ...call, arrival: null },
      event: "arrival",
      locale: "cs",
    }),
  );
  assert.ok(fallback.includes(`>${time(call.departure!, "cs")}</time>`));
});
