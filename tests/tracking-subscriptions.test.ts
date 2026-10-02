import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createTrackingStore } from "../src/modules/TransportTrackingModule/providers/trackingStore";
import { createTrackingSubscriptions } from "../src/modules/TransportTrackingModule/providers/trackingSubscriptions";
import { TransportRequestError } from "../src/modules/TransportCoreModule/providers/client";
import type { TrackingSession } from "../src/modules/TransportCoreModule/types";

test("adding/removing watched trips preserves other sockets and renews single-use tickets", async (t) => {
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
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b", "b"]);
  assert.equal(sockets, 3);
  manager.dispose();
  assert.deepEqual(closed, [2, 1, 3]);
});

test("a dropped socket reconnects with a new ticket instead of replaying the redeemed ticket", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const issued: string[] = [],
    sent: string[] = [];
  let drop = () => {};
  const manager = createTrackingSubscriptions(createTrackingStore(), {
    tracking: async () => {
      const ticket = `single-use-${issued.length}`;
      issued.push(ticket);
      return {
        status: "available",
        url: "ws://localhost",
        ticket,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };
    },
    socket: (options) => {
      assert.equal(options.maxRetries, 0);
      drop = () => options.onState?.("closed");
      return {
        connect() {
          options.onState?.("open");
        },
        send(message) {
          sent.push((message as { ticket: string }).ticket);
          return true;
        },
        close() {
          options.onState?.("closed");
        },
      };
    },
  });
  manager.setIds(["a"]);
  await setImmediate();
  drop();
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(issued, ["single-use-0", "single-use-1"]);
  assert.deepEqual(sent, issued);
  manager.dispose();
  t.mock.timers.tick(60000);
  await setImmediate();
  assert.equal(issued.length, 2);
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
