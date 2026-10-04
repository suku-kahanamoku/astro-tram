import test from "node:test";
import assert from "node:assert/strict";
import {
  tripProgress,
  lastKnownTripProgress,
  compactTripProgress,
  legTimelineProgress,
} from "../src/modules/TransportJourneyModule/providers/tripProgress";
import {
  delayMinutes,
  unavailableObservation,
} from "../src/modules/TransportTrackingModule/providers/tracking";
import type {
  Trip,
  TripObservation,
  Leg,
} from "../src/modules/TransportCoreModule/types";
const now = Date.parse("2026-10-01T10:00:00Z");
const trip: Trip = {
  sourceMode: "live",
  stops: [0, 1, 2].map((i) => ({
    arrival: null,
    departure: null,
    stop: {
      id: String(i),
      name: `Stop ${i}`,
      lat: 50 + i * 0.01,
      lon: 14,
      platform: null,
    },
  })),
};
const live = (lat = 50.005, lon = 14): TripObservation => ({
  status: "live",
  position: { lat, lon },
  observedAt: new Date(now).toISOString(),
  validUntil: new Date(now + 30000).toISOString(),
  delaySeconds: 480,
  cancelled: false,
});
test("a measured position at the origin is visible before the scheduled departure", () => {
  const future = {
    ...trip,
    stops: trip.stops.map((call) => ({
      ...call,
      departure: new Date(now + 3600000).toISOString(),
    })),
  };
  assert.deepEqual(tripProgress(future, live(50), now), {
    from: 0,
    to: 0,
    fraction: 0,
    atStop: true,
  });
  assert.equal(tripProgress(future, undefined, now), null);
});
test("compact accordion axis uses verified progress only within the selected leg", () => {
  const compact = compactTripProgress(tripProgress(trip, live(), now), {
    from: 0,
    to: 2,
  })!;
  assert.equal(compact.from, 0);
  assert.equal(compact.to, 1);
  assert.ok(Math.abs(compact.fraction - 0.25) < 0.00001);
  assert.equal(compact.atStop, false);
  assert.equal(
    compactTripProgress(tripProgress(trip, live(), now), { from: 1, to: 2 }),
    null,
  );
  assert.equal(compactTripProgress(null, { from: 0, to: 2 }), null);
  assert.equal(
    compactTripProgress(tripProgress(trip, live(), now), null),
    null,
  );
});

test("expanded leg axes use actual stop rows and mark measured progress outside the selected segment", () => {
  const progress = { from: 3, to: 4, fraction: 0.4, atStop: false };
  const segment = { from: 2, to: 6 };
  assert.deepEqual(legTimelineProgress(progress, segment, true), { progress });
  assert.ok(
    Math.abs(
      legTimelineProgress(progress, segment, false)!.progress.fraction - 0.35,
    ) < 0.00001,
  );
  assert.deepEqual(legTimelineProgress(progress, { from: 5, to: 7 }, true), {
    progress: { from: 5, to: 5, fraction: 0, atStop: true },
    outside: "before",
  });
  assert.deepEqual(legTimelineProgress(progress, { from: 0, to: 2 }, false), {
    progress: { from: 1, to: 1, fraction: 0, atStop: true },
    outside: "after",
  });
  assert.equal(legTimelineProgress(null, segment, true), null);
  assert.equal(legTimelineProgress(progress, null, true), null);
});

test("schematic GPS projection locates a vehicle between stops without needing timetable times", () => {
  const p = tripProgress(trip, live(), now)!;
  assert.equal(p.from, 0);
  assert.equal(p.to, 1);
  assert.ok(Math.abs(p.fraction - 0.5) < 0.00001);
  assert.equal(p.atStop, false);
  assert.deepEqual(tripProgress(trip, live(50.01), now), {
    from: 1,
    to: 1,
    fraction: 0,
    atStop: true,
  });
  assert.equal(tripProgress(trip, undefined, now), null);
  assert.equal(
    tripProgress(trip, unavailableObservation("unsupported"), now),
    null,
  );
});
test("timeline rejects stale, future, cancelled, invalid and off-route measurements", () => {
  assert.equal(tripProgress(trip, live(), now + 30000), null);
  assert.equal(tripProgress(trip, live(), now - 6000), null);
  assert.equal(tripProgress(trip, { ...live(), cancelled: true }, now), null);
  assert.equal(tripProgress(trip, live(95), now), null);
  assert.equal(tripProgress(trip, live(50.005, 14.1), now), null);
  assert.equal(tripProgress(trip, live(49.99), now), null);
  assert.equal(
    tripProgress(
      trip,
      { ...live(), validUntil: new Date(now + 31000).toISOString() },
      now,
    ),
    null,
  );
});
test("loops, overlapping routes and missing coordinates never select an arbitrary occurrence", () => {
  const loop = {
    ...trip,
    stops: [trip.stops[0], trip.stops[1], trip.stops[0]],
  };
  assert.equal(tripProgress(loop, live(50), now), null);
  assert.equal(tripProgress(loop, live(50.005), now), null);
  const missing = {
    ...trip,
    stops: trip.stops.map((c, i) =>
      i === 1 ? { ...c, stop: { ...c.stop, lat: null } } : c,
    ),
  };
  assert.equal(tripProgress(missing, live(50.005), now), null);
});
test("badges preserve independent arrival-only and numeric delays even without GPS", () => {
  const leg = {
    mode: "tram",
    realtime: true,
    predictionValidUntil: new Date(now + 30000).toISOString(),
    scheduledDeparture: "2026-10-01T10:00:00Z",
    scheduledArrival: "2026-10-01T10:20:00Z",
    expectedDeparture: null,
    expectedArrival: "2026-10-01T10:28:00Z",
  } as Leg;
  assert.equal(
    delayMinutes(leg, unavailableObservation("unsupported"), now),
    8,
  );
  assert.equal(delayMinutes(leg, unavailableObservation(), now), 8);
  assert.equal(delayMinutes({ ...leg, delaySeconds: 120 }, undefined, now), 2);
  assert.equal(delayMinutes({ ...leg, delaySeconds: 0 }, undefined, now), 0);
  assert.equal(delayMinutes(leg, undefined, now + 30000), 0);
  assert.equal(delayMinutes(leg, { ...live(), delaySeconds: 0 }, now), 0);
  assert.equal(
    delayMinutes({ ...leg, realtime: false }, live(), now + 30000),
    0,
  );
});

test("a dated last-known measurement can initialise the dot without being treated as live GPS", () => {
  const known = {
    ...live(),
    status: "last_known",
    observedAt: new Date(now - 45000).toISOString(),
    validUntil: new Date(now + 45000).toISOString(),
  };
  assert.equal(tripProgress(trip, known, now), null);
  assert.equal(lastKnownTripProgress(trip, known, now)?.from, 0);
  assert.equal(lastKnownTripProgress(trip, known, now + 45000), null);
  assert.equal(
    lastKnownTripProgress(
      trip,
      { ...known, position: { lat: 95, lon: 14 } },
      now,
    ),
    null,
  );
  assert.equal(
    lastKnownTripProgress(
      trip,
      { ...known, validUntil: new Date(now + 46000).toISOString() },
      now,
    ),
    null,
  );
});
