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
  isFollowingDay,
} from "../src/modules/TransportJourneyModule/providers/render";
import ScheduleTime from "../src/modules/TransportJourneyModule/components/ScheduleTime";
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

test("next-day clocks compare the displayed local calendar day across UTC boundaries, months and DST", () => {
  const previousZone = process.env.TZ;
  process.env.TZ = "Europe/Prague";
  try {
    const start = "2026-10-04T21:45:00Z"; // 23:45 locally
    assert.equal(isFollowingDay("2026-10-04T21:56:00Z", start), false);
    assert.equal(isFollowingDay("2026-10-04T22:00:00Z", start), true);
    assert.equal(isFollowingDay("2026-10-04T22:37:00Z", start), true);
    // Both UTC dates below still display as 5 October locally.
    assert.equal(
      isFollowingDay("2026-10-05T00:12:00Z", "2026-10-04T22:00:00Z"),
      false,
    );
    assert.equal(
      isFollowingDay("2027-01-01T00:00:00+01:00", "2026-12-31T23:59:00+01:00"),
      true,
    );
    assert.equal(
      isFollowingDay("2026-03-30T00:00:00+02:00", "2026-03-29T00:30:00+01:00"),
      true,
    );
    assert.equal(
      isFollowingDay("2026-10-25T02:15:00+01:00", "2026-10-25T02:45:00+02:00"),
      false,
    );
    assert.equal(isFollowingDay("2026-10-04T21:40:00Z", start), false);
    assert.equal(isFollowingDay(start, undefined), false);
    assert.equal(isFollowingDay("invalid", start), false);
    assert.equal(isFollowingDay(start, "invalid"), false);

    const html = renderToStaticMarkup(
      createElement(ScheduleTime, {
        value: "2026-10-04T22:00:00Z",
        referenceTime: start,
        locale: "cs",
      }),
    );
    assert.ok(html.includes('data-next-day="true"'));
    assert.ok(html.includes(">00:00</time>"));
    assert.ok(html.includes('title="pondělí 5. října 2026"'));
    const missing = renderToStaticMarkup(
      createElement(ScheduleTime, {
        value: null,
        referenceTime: start,
        locale: "cs",
      }),
    );
    assert.ok(missing.includes(">—</time>"));
    assert.ok(!missing.includes("data-next-day"));
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});
