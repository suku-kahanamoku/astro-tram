import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createTripResources } from "../src/modules/TransportJourneyModule/providers/tripResources";
import type { Trip } from "../src/modules/TransportCoreModule/types";
const trip: Trip = { stops: [], sourceMode: "schedule" };
test("static prefetch is bounded, deduplicated and prioritizes an opened trip", async () => {
  const started: string[] = [];
  const finish = new Map<string, (trip: Trip) => void>();
  const resources = createTripResources((id) => {
    started.push(id);
    return new Promise((resolve) => finish.set(id, resolve));
  });
  const a = resources.load("a", false),
    b = resources.load("b", false),
    c = resources.load("c", false),
    d = resources.load("d", false);
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(resources.load("d"), d);
  finish.get("a")!(trip);
  await a;
  await setImmediate();
  assert.deepEqual(started, ["a", "b", "d"]);
  assert.equal(resources.peek("a"), trip);
  assert.equal(resources.load("a"), a);
  finish.get("b")!(trip);
  await b;
  await setImmediate();
  assert.deepEqual(started, ["a", "b", "d", "c"]);
  finish.get("c")!(trip);
  finish.get("d")!(trip);
  await Promise.all([c, d]);
  resources.dispose();
});
test("failed prefetch can retry; disposing aborts requests and rejects queued work", async () => {
  let attempts = 0;
  const retry = createTripResources(async () => {
    if (++attempts === 1) throw new Error("offline");
    return trip;
  });
  await assert.rejects(retry.load("a", false), /offline/);
  assert.equal(await retry.load("a"), trip);
  assert.equal(attempts, 2);
  retry.dispose();
  let aborted = 0;
  const resources = createTripResources(
    (_id, signal) =>
      new Promise((_yes, no) => {
        signal.addEventListener("abort", () => {
          aborted++;
          no(new Error("aborted"));
        });
      }),
  );
  const jobs = ["a", "b", "c"].map((id) => resources.load(id, false));
  const settled = Promise.allSettled(jobs);
  resources.dispose();
  assert.equal(aborted, 2);
  assert.ok((await settled).every((result) => result.status === "rejected"));
  await assert.rejects(resources.load("d"), /disposed/);
});

test("optional coordinates have their own shared request and cannot replace static stop rows", async () => {
  let staticReads = 0,
    coordinateReads = 0;
  const original: Trip = {
    stops: [
      {
        stop: {
          id: "stop",
          name: "Stop",
          lat: null,
          lon: null,
          platform: null,
        },
        arrival: null,
        departure: "2026-10-05T12:00:00Z",
        expectedArrival: null,
        expectedDeparture: null,
      },
    ],
    sourceMode: "schedule",
  };
  const enriched = {
    ...original,
    stops: original.stops.map((call) => ({
      ...call,
      stop: { ...call.stop, lat: 49.2, lon: 16.6 },
    })),
  };
  const resources = createTripResources(
    async () => {
      staticReads++;
      return original;
    },
    async () => {
      coordinateReads++;
      return enriched;
    },
  );
  assert.equal(await resources.load("trip"), original);
  const a = resources.load("trip", true, true);
  assert.equal(resources.load("trip", true, true), a);
  assert.equal(await a, enriched);
  assert.equal(resources.peek("trip"), original);
  assert.equal(resources.peek("trip", true), enriched);
  assert.equal(original.stops[0].stop.lat, null);
  assert.equal(await resources.load("trip"), original);
  assert.equal(staticReads, 1);
  assert.equal(coordinateReads, 1);
  resources.dispose();
});

test("trip detail retention has a byte budget; oversized results remain usable but reload on reopen", async () => {
  let reads = 0;
  const large: Trip = {
    ...trip,
    stops: [
      {
        stop: {
          id: "large",
          name: "x".repeat(1000),
          lat: null,
          lon: null,
          platform: null,
        },
        arrival: null,
        departure: null,
      },
    ],
  };
  const resources = createTripResources(
    async () => {
      reads++;
      return large;
    },
    undefined,
    { entries: 10, bytes: 100, concurrency: 2 },
  );
  assert.equal(await resources.load("large"), large);
  assert.equal(resources.peek("large"), undefined);
  assert.equal(await resources.load("large"), large);
  assert.equal(reads, 2);
  resources.dispose();
});

test("detail resources do not retain predictions mixed into an otherwise static trip", async () => {
  const predicted: Trip = {
    sourceMode: "schedule",
    stops: [
      {
        stop: {
          id: "stop",
          name: "Stop",
          lat: null,
          lon: null,
          platform: null,
        },
        arrival: null,
        departure: "2026-10-09T12:00:00Z",
        expectedDeparture: "2026-10-09T12:05:00Z",
        predictionValidUntil: "2026-10-09T12:01:00Z",
      },
    ],
  };
  let reads = 0;
  const resources = createTripResources(async () => {
    reads++;
    return predicted;
  });
  assert.equal(await resources.load("predicted"), predicted);
  assert.equal(resources.peek("predicted"), undefined);
  await resources.load("predicted");
  assert.equal(reads, 2);
  resources.dispose();
});
