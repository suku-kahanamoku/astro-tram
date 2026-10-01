import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createTripResources } from "../src/modules/TransportModule/providers/tripResources";
import type { Trip } from "../src/modules/TransportModule/types";
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
