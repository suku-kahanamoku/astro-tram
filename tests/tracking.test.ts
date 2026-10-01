import test from "node:test";
import assert from "node:assert/strict";
import {
  observation,
  unavailableObservation,
  delayMinutes,
  trackedLeg,
  transferAtRisk,
} from "../src/modules/TransportModule/providers/tracking";
import type { Leg } from "../src/modules/TransportModule/types";
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
test("badge is shown only for positive verified delay; unknown is not on time", () => {
  const live = {
    ...unavailableObservation(),
    status: "live",
    delaySeconds: 480,
  };
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
