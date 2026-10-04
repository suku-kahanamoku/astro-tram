import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import {
  observation,
  knownDelayMinutes,
} from "../src/modules/TransportTrackingModule/providers/tracking";
import {
  estimatedTripProgress,
  tripProgress,
} from "../src/modules/TransportJourneyModule/providers/tripProgress";
import type { Trip, Leg } from "../src/modules/TransportCoreModule/types";

const now = Date.parse("2026-10-04T10:10:00Z");
const progress = {
  from_index: 0,
  to_index: 1,
  from_stop_id: "stop_A",
  to_stop_id: "stop_B",
  from_departure: "2026-10-04T10:00:00Z",
  to_arrival: "2026-10-04T10:20:00Z",
  fraction: 0.37,
  at_stop: false,
  observed_at: new Date(now).toISOString(),
  valid_until: new Date(now + 30000).toISOString(),
};
const raw = {
  status: "estimated",
  position: null,
  delay_seconds: null,
  cancelled: null,
  observed_at: progress.observed_at,
  valid_until: progress.valid_until,
  estimated_progress: progress,
};
const trip: Trip = {
  sourceMode: "schedule",
  stops: [
    {
      stop: {
        id: "stop_A",
        name: "Origin",
        lat: null,
        lon: null,
        platform: null,
      },
      arrival: "2026-10-04T09:58:00Z",
      departure: progress.from_departure,
    },
    {
      stop: {
        id: "stop_B",
        name: "Destination",
        lat: null,
        lon: null,
        platform: null,
      },
      arrival: progress.to_arrival,
      departure: "2026-10-04T10:25:00Z",
    },
  ],
};

test("the BFF forwards only public estimated progress and the client keeps it distinct from GPS and delay", async () => {
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://core.test",
        apiKey: "secret",
        tenantHost: "tram.test",
      },
      async () =>
        Response.json({
          success: true,
          data: {
            ...raw,
            private_key: "secret",
            estimated_progress: { ...progress, private_key: "secret" },
          },
        }),
    ),
  );
  const data = await provider.observation("trip_id");
  assert.deepEqual(data, raw);
  const value = observation(data, now);
  assert.equal(value.status, "estimated");
  assert.equal(value.position, null);
  assert.equal(value.delaySeconds, null);
  assert.equal(knownDelayMinutes({ realtime: false } as Leg, value, now), null);
  assert.equal(tripProgress(trip, value, now), null);
  assert.deepEqual(estimatedTripProgress(trip, value, now), {
    from: 0,
    to: 1,
    fraction: 0.37,
    atStop: false,
  });
  // The browser displays the backend's value rather than recomputing progress from local time.
  assert.equal(estimatedTripProgress(trip, value, now + 20000)?.fraction, 0.37);
  assert.equal(estimatedTripProgress(trip, value, now + 30000), null);
  assert.equal(
    observation({ ...raw, delay_seconds: 0 }, now).delaySeconds,
    null,
  );
});

test("estimates cannot attach to different stop occurrences, service times, cancellations or malformed frames", () => {
  const value = observation(raw, now);
  assert.equal(
    estimatedTripProgress(
      { ...trip, stops: [...trip.stops].reverse() },
      value,
      now,
    ),
    null,
  );
  assert.equal(
    estimatedTripProgress(
      {
        ...trip,
        stops: trip.stops.map((call) => ({
          ...call,
          departure: "2026-10-05T10:00:00Z",
        })),
      },
      value,
      now,
    ),
    null,
  );
  assert.equal(
    estimatedTripProgress(trip, { ...value, cancelled: true }, now),
    null,
  );
  assert.equal(
    observation({ status: "unavailable" }, now).estimatedProgress,
    undefined,
  );
  assert.equal(
    observation({ ...raw, estimated_progress: undefined }, now).status,
    "unavailable",
  );
  for (const invalid of [
    { fraction: 2 },
    { from_index: -1 },
    { to_index: 2 },
    { at_stop: true },
    { valid_until: new Date(now + 31000).toISOString() },
  ]) {
    assert.equal(
      observation(
        { ...raw, estimated_progress: { ...progress, ...invalid } },
        now,
      ).estimatedProgress,
      undefined,
    );
  }
  assert.equal(observation(raw, now - 6000).estimatedProgress, undefined);
  assert.equal(observation(raw, now + 30000).estimatedProgress, undefined);
});
