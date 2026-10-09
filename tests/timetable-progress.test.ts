import test from "node:test";
import assert from "node:assert/strict";
import type {
  Trip,
  TripObservation,
} from "../src/modules/TransportCoreModule/types";
import { timetableTripProgress } from "../src/modules/TransportJourneyModule/providers/timetableProgress";
import { displayTripProgress } from "../src/modules/TransportJourneyModule/providers/tripProgress";

const instant = (minutes: number) =>
  new Date(
    Date.parse("2026-10-08T23:58:00+02:00") + minutes * 60000,
  ).toISOString();
const trip: Trip = {
  sourceMode: "schedule",
  stops: [0, 1, 2].map((i) => ({
    stop: {
      id: String(i),
      name: `Stop ${i}`,
      lat: 50 + i * 0.01,
      lon: 14,
      platform: null,
    },
    arrival: i === 0 ? null : instant(i * 10),
    departure: i === 2 ? null : instant(i * 10 + (i === 1 ? 2 : 0)),
  })),
};
const at = (index: number) => ({
  from: index,
  to: index,
  fraction: 0,
  atStop: true,
});
const predict = (minutes: number, value = trip) =>
  timetableTripProgress(value, Date.parse(instant(minutes)));

test("timetable marker waits at the origin and stays at the terminus after the trip", () => {
  assert.deepEqual(predict(-60), at(0));
  assert.deepEqual(predict(0), at(0));
  assert.deepEqual(predict(20), at(2));
  assert.deepEqual(predict(1440), at(2));
});
test("timetable prediction crosses midnight, interpolates journeys and respects dwell times", () => {
  const original = structuredClone(trip);
  assert.deepEqual(predict(5), {
    from: 0,
    to: 1,
    fraction: 0.5,
    atStop: false,
  });
  assert.deepEqual(predict(10), at(1));
  assert.deepEqual(predict(11), at(1));
  assert.deepEqual(predict(12), at(1));
  assert.deepEqual(predict(16), {
    from: 1,
    to: 2,
    fraction: 0.5,
    atStop: false,
  });
  assert.deepEqual(
    trip,
    original,
    "Predictions must never alter static times or stop data",
  );
});
test("prediction works without GPS and keeps a safe anchor when times are absent or invalid", () => {
  const noCoordinates = {
    ...trip,
    stops: trip.stops.map((c) => ({
      ...c,
      stop: { ...c.stop, lat: null, lon: null },
    })),
  };
  assert.deepEqual(predict(5, noCoordinates), predict(5));
  const untimed = {
    ...trip,
    stops: trip.stops.map((c) => ({
      ...c,
      arrival: null,
      departure: "invalid",
    })),
  };
  assert.deepEqual(predict(5, untimed), at(0));
  assert.deepEqual(predict(5, { ...trip, stops: [trip.stops[0]] }), at(0));
  assert.equal(predict(5, { ...trip, stops: [] }), null);
  const missing = {
    ...trip,
    stops: trip.stops.map((c, i) =>
      i === 1 ? { ...c, arrival: null, departure: null } : c,
    ),
  };
  assert.deepEqual(
    predict(16, missing),
    at(0),
    "Never invent interpolation across an untimed stop",
  );
});
test("unconfirmed position support keeps a visible origin anchor without predicting movement", () => {
  const now = Date.parse(instant(16));
  for (const status of [
    "pending",
    "unavailable",
    "unsupported",
    "stale",
    "live",
  ]) {
    const live: TripObservation = {
      status,
      position: null,
      observedAt: new Date(now).toISOString(),
      validUntil: new Date(now + 30000).toISOString(),
      delaySeconds: status === "live" ? 600 : null,
      cancelled: false,
    };
    assert.deepEqual(displayTripProgress(trip, live, null, now), {
      progress: at(0),
      retained: false,
      estimated: true,
      timetable: false,
    });
  }
  assert.deepEqual(
    displayTripProgress(trip, undefined, null, now).progress,
    at(0),
  );
  assert.deepEqual(
    displayTripProgress(trip, undefined, null, now, true).progress,
    predict(16),
    "Only verified absence of a position provider permits local prediction",
  );
});
test("live GPS overrides permitted prediction, gaps retain the last measured point, estimates never become measurements", () => {
  const now = Date.parse(instant(5));
  const live: TripObservation = {
    status: "live",
    position: { lat: 50.01, lon: 14 },
    observedAt: new Date(now).toISOString(),
    validUntil: new Date(now + 30000).toISOString(),
    cancelled: false,
    delaySeconds: null,
  };
  assert.deepEqual(displayTripProgress(trip, undefined, null, now, true), {
    progress: predict(5),
    retained: false,
    estimated: true,
    timetable: true,
  });
  const measured = displayTripProgress(trip, live, null, now);
  assert.deepEqual(measured, {
    progress: at(1),
    retained: false,
    estimated: false,
    timetable: false,
  });
  assert.deepEqual(
    displayTripProgress(
      trip,
      { ...live, status: "unavailable", position: null },
      measured.progress,
      now + 60000,
    ),
    { progress: at(1), retained: true, estimated: false, timetable: false },
  );
  assert.deepEqual(
    displayTripProgress(trip, live, null, now + 60000).progress,
    at(0),
  );
  assert.deepEqual(
    displayTripProgress(trip, live, null, now + 60000, true).progress,
    at(0),
    "Even a previous estimate permission must not override a stale GPS sample",
  );
});

test("completed trips stay at the terminus and remembered GPS never resets to the origin", () => {
  const now = Date.parse(instant(25));
  assert.deepEqual(
    displayTripProgress(trip, undefined, null, now, true).progress,
    at(2),
  );
  const completed: TripObservation = {
    status: "live",
    position: { lat: 50.02, lon: 14 },
    observedAt: new Date(now).toISOString(),
    validUntil: new Date(now + 30000).toISOString(),
    cancelled: false,
    delaySeconds: null,
  };
  const measured = displayTripProgress(trip, completed, null, now);
  assert.deepEqual(measured.progress, at(2));
  assert.deepEqual(
    displayTripProgress(trip, undefined, measured.progress, now + 600000),
    { progress: at(2), retained: true, estimated: false, timetable: false },
  );
});
