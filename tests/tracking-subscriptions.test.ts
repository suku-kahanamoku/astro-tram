import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createTrackingStore } from "../src/modules/TransportModule/providers/trackingStore";
import { createTrackingSubscriptions } from "../src/modules/TransportModule/providers/trackingSubscriptions";
import { TransportRequestError } from "../src/modules/TransportModule/providers/client";
import type { TrackingSession } from "../src/modules/TransportModule/types";

test("adding/removing watched trips preserves other sockets and reuses unexpired tickets", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const requests: string[] = [],
    closed: number[] = [];
  let sockets = 0;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async (id): Promise<TrackingSession> => {
      requests.push(id);
      return {
        status: "available",
        url: "ws://localhost",
        ticket: id,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };
    },
    socket: () => {
      const n = ++sockets;
      return {
        connect() {},
        send() {
          return true;
        },
        close() {
          closed.push(n);
        },
      };
    },
  });
  manager.setIds(["a"]);
  await setImmediate();
  manager.setIds(["a", "b"]);
  assert.deepEqual(requests, ["a"]);
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b"]);
  assert.deepEqual(closed, []);
  store.set("b", {
    status: "unavailable",
    position: null,
    observedAt: null,
    validUntil: null,
    delaySeconds: null,
    cancelled: null,
  });
  manager.setIds(["a"]);
  assert.equal(store.getSnapshot().b, undefined);
  assert.deepEqual(closed, [2]);
  manager.setIds(["a", "b"]);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b"]);
  assert.equal(sockets, 3);
  manager.dispose();
  assert.deepEqual(closed, [2, 1, 3]);
});

test("429 cools down the entire ticket queue; no burst on adding or removing another trip", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const requests: string[] = [];
  const manager = createTrackingSubscriptions(createTrackingStore(), {
    tracking: async (id): Promise<TrackingSession> => {
      requests.push(id);
      if (requests.length === 1)
        throw new TransportRequestError("rate_limited", 429, 5000);
      return { status: "unsupported" };
    },
    socket: () => {
      throw new Error("unsupported trip cannot connect");
    },
  });
  manager.setIds(["a", "b"]);
  await setImmediate();
  manager.setIds(["a", "b", "c"]);
  t.mock.timers.tick(4999);
  await setImmediate();
  assert.deepEqual(requests, ["a"]);
  t.mock.timers.tick(1);
  await setImmediate();
  assert.equal(requests.length, 2);
  manager.dispose();
  t.mock.timers.tick(100000);
  await setImmediate();
  assert.equal(requests.length, 2);
});
