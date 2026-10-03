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

test("fresh delay-only observations do not require GPS and keep the same expiry rules", () => {
  const now = Date.parse("2026-10-01T08:00:00Z");
  const raw = {
    status: "live",
    position: null,
    observed_at: new Date(now).toISOString(),
    valid_until: new Date(now + 30000).toISOString(),
    delay_seconds: 480,
  };
  const live = observation(raw, now);
  assert.equal(live.status, "live");
  assert.equal(live.position, null);
  assert.equal(knownDelayMinutes(leg, live, now), 8);
  assert.equal(
    knownDelayMinutes(leg, observation({ ...raw, delay_seconds: 0 }, now), now),
    0,
  );
  assert.equal(observation(raw, now + 30000).delaySeconds, null);
  assert.equal(
    observation({ ...raw, delay_seconds: 86401 }, now).delaySeconds,
    null,
  );
  assert.equal(
    observation({ ...raw, status: "last_known" }, now).status,
    "unavailable",
  );
});

test("transfer warnings identify only the connecting leg and account for walking and its delay", () => {
  const first = { ...leg, tripId: "a" };
  const walk = {
    ...leg,
    mode: "walk",
    tripId: null,
    scheduledDeparture: "2026-10-01T08:20:00Z",
    scheduledArrival: "2026-10-01T08:23:00Z",
  };
  const next = {
    ...leg,
    tripId: "b",
    minTransferSeconds: 60,
    scheduledDeparture: "2026-10-01T08:25:00Z",
    scheduledArrival: "2026-10-01T09:00:00Z",
  };
  const journey = { legs: [first, walk, next], duration: 3600 } as Journey;
  const live = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
  };
  assert.deepEqual(trackedJourney(journey, {}).transferRiskLegs, []);
  assert.deepEqual(trackedJourney(journey, { a: live }).transferRiskLegs, [2]);
  assert.deepEqual(
    trackedJourney(journey, { a: live, b: { ...live, delaySeconds: 480 } })
      .transferRiskLegs,
    [],
  );
  assert.deepEqual(
    trackedJourney(journey, { a: { ...live, delaySeconds: 0 } })
      .transferRiskLegs,
    [],
  );
  assert.equal(journey.legs[1].scheduledArrival, walk.scheduledArrival);
  assert.equal(journey.legs[2].expectedDeparture, null);
});

test("last-known GPS preserves its source age and never moves times or confirms delay", () => {
  const now = Date.parse("2026-10-01T08:00:00Z");
  const raw = {
    status: "last_known",
    position: { lat: 50, lon: 14 },
    observed_at: new Date(now - 45000).toISOString(),
    valid_until: new Date(now + 45000).toISOString(),
    delay_seconds: 480,
  };
  const known = observation(raw, now);
  assert.equal(known.status, "last_known");
  assert.equal(known.observedAt, raw.observed_at);
  assert.equal(known.delaySeconds, null);
  assert.equal(knownDelayMinutes(leg, known, now), null);
  assert.equal(trackedLeg(leg, known, now).expectedArrival, null);
  assert.equal(
    callTime(
      { arrival: null, departure: leg.scheduledArrival } as TripStop,
      "departure",
      known,
      now,
    ).value,
    leg.scheduledArrival,
  );
  assert.equal(observation(raw, now + 45000).position, null);
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
