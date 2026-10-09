import test from "node:test";
import assert from "node:assert/strict";
import { StaticResponseCache } from "../src/modules/TransportCoreModule/providers/staticResponseCache";
const limits = { entries: 2, bytes: 1024, pending: 2 };
test("invalid bounds cannot create unbounded caches or eviction loops", async () => {
  assert.throws(
    () => new StaticResponseCache({ ...limits, entries: 0 }),
    RangeError,
  );
  assert.throws(
    () => new StaticResponseCache({ ...limits, pending: -1 }),
    RangeError,
  );
  await assert.rejects(
    new StaticResponseCache(limits).get("trip", 0, async () => ({})),
    RangeError,
  );
});
test("static cache joins requests, clones results, expires and evicts old keys", async () => {
  let now = 0,
    reads = 0;
  const cache = new StaticResponseCache(limits, () => now);
  const load = async () => {
    reads++;
    return { stops: [{ name: "Brno" }] };
  };
  const [one, two] = await Promise.all([
    cache.get("trip:revision1", 10, load),
    cache.get("trip:revision1", 10, load),
  ]);
  one.stops[0].name = "changed";
  assert.equal(two.stops[0].name, "Brno");
  assert.equal(reads, 1);
  assert.equal(
    (await cache.get("trip:revision1", 10, load)).stops[0].name,
    "Brno",
  );
  now = 10;
  await cache.get("trip:revision1", 10, load);
  assert.equal(reads, 2);
  await cache.get("trip:revision2", 10, load);
  await cache.get("stop", 10, load);
  await cache.get("trip:revision1", 10, load);
  assert.equal(reads, 5);
});
test("live data and failures are never retained", async () => {
  const cache = new StaticResponseCache(limits);
  let reads = 0;
  for (const value of [
    { realtime: true },
    { position: { lat: 49 } },
    { delaySeconds: 60 },
    { stops: [{ expectedArrival: "now" }] },
  ]) {
    const load = async () => {
      reads++;
      return value;
    };
    await cache.get("resource", 1000, load);
    await cache.get("resource", 1000, load);
  }
  assert.equal(reads, 8);
  await assert.rejects(
    cache.get("resource", 1000, async () => {
      throw new Error("upstream");
    }),
  );
  assert.deepEqual(
    await cache.get("resource", 1000, async () => ({ name: "static" })),
    { name: "static" },
  );
});
test("one cancelled subscriber does not cancel another and last cancellation permits retry", async () => {
  const cache = new StaticResponseCache(limits);
  const one = new AbortController(),
    two = new AbortController();
  let release!: (value: { name: string }) => void;
  const pending = new Promise<{ name: string }>((resolve) => {
    release = resolve;
  });
  const first = cache.get("trip", 1000, () => pending, one.signal);
  const second = cache.get("trip", 1000, () => pending, two.signal);
  one.abort();
  await assert.rejects(first, { name: "AbortError" });
  release({ name: "Brno" });
  assert.deepEqual(await second, { name: "Brno" });
  const last = new AbortController();
  const cancelled = cache.get(
    "new",
    1000,
    (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
    last.signal,
  );
  await Promise.resolve();
  last.abort();
  await assert.rejects(cancelled, { name: "AbortError" });
  assert.equal(await cache.get("new", 1000, async () => "retry"), "retry");
});
