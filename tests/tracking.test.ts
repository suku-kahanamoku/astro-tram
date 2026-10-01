import test from "node:test";
import assert from "node:assert/strict";
import {
  observation,
  unavailableObservation,
  delayMinutes,
  knownDelayMinutes,
  trackedLeg,
  transferAtRisk,
  trackedJourney,
  callTime,
} from "../src/modules/TransportTrackingModule/providers/tracking";
import type {
  Leg,
  Journey,
  TripStop,
} from "../src/modules/TransportCoreModule/types";
const leg = {
  mode: "bus",
  scheduledDeparture: "2026-10-01T08:00:00Z",
  scheduledArrival: "2026-10-01T08:20:00Z",
  expectedDeparture: null,
  expectedArrival: null,
  realtime: false,
  cancelled: false,
} as Leg;
test("vehicle positions expire based on upstream observation and reject malformed or future GPS", () => {
  const now = Date.parse("2026-10-01T08:00:00Z");
  const raw = {
    status: "live",
    position: { lat: 50, lon: 14 },
    observed_at: new Date(now).toISOString(),
    valid_until: new Date(now + 30000).toISOString(),
    delay_seconds: 480,
  };
  assert.equal(observation(raw, now).delaySeconds, 480);
  assert.equal(observation(raw, now + 30000).position, null);
  assert.equal(observation(raw, now - 6000).position, null);
  assert.equal(
    observation({ ...raw, position: { lat: 91, lon: 14 } }, now).position,
    null,
  );
  assert.equal(
    observation(
      { ...raw, valid_until: new Date(now + 31000).toISOString() },
      now,
    ).position,
    null,
  );
});
test("delay presentation distinguishes confirmed zero, positive delay and unknown", () => {
  const live = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
    observedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30000).toISOString(),
  };
  assert.equal(knownDelayMinutes(leg, live), 8);
  assert.equal(knownDelayMinutes(leg, { ...live, delaySeconds: 0 }), 0);
  assert.equal(knownDelayMinutes(leg, unavailableObservation("stale")), null);
  assert.equal(
    knownDelayMinutes({
      ...leg,
      realtime: true,
      predictionValidUntil: live.validUntil,
    }),
    null,
  );
  assert.equal(delayMinutes(leg, live), 8);
  assert.equal(delayMinutes(leg, { ...live, delaySeconds: 0 }), 0);
  assert.equal(delayMinutes(leg, { ...live, delaySeconds: -20 }), 0);
  assert.equal(delayMinutes(leg, unavailableObservation("stale")), 0);
});
test("live feeder delay causes a transfer warning without postponing the connecting service", () => {
  const live = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
  };
  const feeder = trackedLeg(leg, live);
  const next = {
    ...leg,
    scheduledDeparture: "2026-10-01T08:25:00Z",
    scheduledArrival: "2026-10-01T09:00:00Z",
  };
  assert.equal(feeder.expectedArrival, "2026-10-01T08:28:00.000Z");
  assert.equal(feeder.arrivalEstimated, true);
  assert.equal(transferAtRisk([feeder, next]), true);
  assert.equal(next.expectedDeparture, null);
  assert.equal(
    transferAtRisk([feeder, trackedLeg(next, { ...live, delaySeconds: 600 })]),
    false,
  );
});

test("duration is recalculated from real endpoints, not blindly incremented by every vehicle delay", () => {
  const live = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
  };
  const single = { legs: [{ ...leg, tripId: "a" }], duration: 1200 } as Journey;
  assert.equal(
    trackedJourney(single, { a: live }).duration,
    1200,
    "both departure and arrival move: riding time unchanged",
  );
  const connection = {
    legs: [
      { ...leg, tripId: "a" },
      {
        ...leg,
        tripId: "b",
        scheduledDeparture: "2026-10-01T08:40:00Z",
        scheduledArrival: "2026-10-01T09:00:00Z",
      },
    ],
    duration: 3600,
  } as Journey;
  assert.equal(
    trackedJourney(connection, { b: live }).duration,
    4080,
    "delayed final arrival increases total duration",
  );
  assert.equal(
    trackedJourney(connection, { a: live }).duration,
    3120,
    "waiting absorbs feeder delay; no double counting",
  );
});
test("walking legs and visible intermediate stop predictions use updated times across midnight", () => {
  const observation = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
    observedAt: "2026-10-01T23:40:00Z",
    validUntil: "2026-10-01T23:40:30Z",
  };
  const night = {
    ...leg,
    tripId: "a",
    scheduledDeparture: "2026-10-01T23:45:00Z",
    scheduledArrival: "2026-10-01T23:58:00Z",
  };
  const walk = {
    ...leg,
    mode: "walk",
    scheduledDeparture: "2026-10-01T23:58:00Z",
    scheduledArrival: "2026-10-02T00:03:00Z",
  };
  const result = trackedJourney(
    { legs: [night, walk], duration: 1080 } as Journey,
    { a: observation },
  );
  assert.equal(result.legs[1].expectedArrival, "2026-10-02T00:11:00.000Z");
  assert.equal(result.duration, 1080);
  assert.equal(
    callTime(
      { arrival: null, departure: "2026-10-01T23:58:00Z" } as TripStop,
      "departure",
      observation,
    ).value,
    "2026-10-02T00:06:00.000Z",
  );
  assert.equal(
    callTime(
      { arrival: null, departure: "2026-10-01T22:00:00Z" } as TripStop,
      "departure",
      observation,
    ).value,
    "2026-10-01T22:00:00Z",
    "current delay must not rewrite past calls",
  );
});
test("expired predictions restore scheduled times and provider minimum transfer remains respected", () => {
  const expired = {
    ...leg,
    expectedDeparture: "2026-10-01T08:08:00Z",
    expectedArrival: "2026-10-01T08:28:00Z",
    realtime: true,
    predictionValidUntil: "2026-10-01T07:00:00Z",
  };
  assert.equal(
    trackedLeg(expired, undefined, Date.parse("2026-10-01T08:00:00Z"))
      .expectedArrival,
    null,
  );
  const next = {
    ...leg,
    minTransferSeconds: 180,
    scheduledDeparture: "2026-10-01T08:22:00Z",
    scheduledArrival: "2026-10-01T09:00:00Z",
  };
  assert.equal(transferAtRisk([leg, next]), true);
});
