import { test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { createTrackingStore } from "../src/modules/TransportTrackingModule/providers/trackingStore";
import { createTrackingSubscriptions } from "../src/modules/TransportTrackingModule/providers/trackingSubscriptions";
import { TransportRequestError } from "../src/modules/TransportCoreModule/providers/client";
import type { TrackingSession } from "../src/modules/TransportCoreModule/types";

const point = (delay = 120) => ({
  status: "live",
  position: { lat: 50, lon: 14 },
  observed_at: new Date().toISOString(),
  valid_until: new Date(Date.now() + 30000).toISOString(),
  delay_seconds: delay,
  cancelled: false,
});

test("fresh measured GPS takes precedence over a newer timetable estimate without prolonging its expiry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let push!: (data: unknown) => void;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    socket: (options) => {
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "trip", data });
      return { connect() {}, send: () => true, close() {} };
    },
  });
  manager.setIds(["trip"]);
  await setImmediate();
  const estimate = {
    ...point(),
    status: "estimated",
    position: null,
    delay_seconds: null,
    cancelled: null,
    estimated_progress: {
      from_index: 0,
      to_index: 1,
      from_stop_id: "A",
      to_stop_id: "B",
      from_departure: new Date(0).toISOString(),
      to_arrival: new Date(60000).toISOString(),
      fraction: 0.5,
      at_stop: false,
      observed_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 30000).toISOString(),
    },
  };
  push(estimate);
  assert.ok(store.getSnapshot().trip.estimatedProgress);
  const measured = {
    ...point(),
    observed_at: new Date(Date.now() - 1000).toISOString(),
    valid_until: new Date(Date.now() + 29000).toISOString(),
  };
  push(measured);
  assert.equal(store.getSnapshot().trip.position?.lat, 50);
  push(estimate);
  assert.equal(store.getSnapshot().trip.estimatedProgress, undefined);
  t.mock.timers.tick(29000);
  assert.equal(store.getSnapshot().trip.status, "stale");
  manager.dispose();
});

test("focused observation loads immediately even while its socket ticket is queued", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const reads: string[] = [],
    tickets: string[] = [];
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async (id) => {
      tickets.push(id);
      return { status: "unsupported" };
    },
    observation: async (id) => {
      reads.push(id);
      return point();
    },
    socket: () => {
      throw Error("not connected");
    },
  });
  manager.setIds(["accordion", "dialog"]);
  manager.refresh("dialog");
  assert.deepEqual(reads, ["dialog"]);
  await setImmediate();
  assert.deepEqual(tickets, ["accordion"]);
  assert.equal(store.getSnapshot().dialog.status, "live");
  assert.equal(store.getSnapshot().dialog.delaySeconds, 120);
  manager.refresh("dialog");
  await setImmediate();
  assert.deepEqual(
    reads,
    ["dialog", "dialog"],
    "reopening an already watched trip refreshes GPS",
  );
  manager.dispose();
});

test("a late initial HTTP response cannot replace a newer socket observation", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let finish!: (value: unknown) => void;
  let push!: (data: unknown) => void;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    observation: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    socket: (options) => {
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "dialog", data });
      return {
        connect() {},
        send() {
          return true;
        },
        close() {},
      };
    },
  });
  manager.setIds(["dialog"]);
  manager.refresh("dialog");
  await setImmediate();
  push(point(240));
  finish(point(120));
  await setImmediate();
  assert.equal(store.getSnapshot().dialog.delaySeconds, 240);
  manager.dispose();
});

test("an unavailable socket frame cannot block the dialog's initial delay-only read", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let finish!: (value: unknown) => void;
  let push!: (data: unknown) => void;
  let sockets = 0;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    observation: () => new Promise((resolve) => (finish = resolve)),
    socket: (options) => {
      sockets++;
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "dialog", data });
      return {
        connect() {
          options.onState?.("open");
        },
        send: () => true,
        close() {},
      };
    },
  });
  manager.setIds(["dialog"]);
  manager.refresh("dialog");
  await setImmediate();
  push({ status: "unavailable" });
  finish({ ...point(480), position: null });
  await setImmediate();
  assert.equal(store.getSnapshot().dialog.delaySeconds, 480);
  assert.equal(store.getSnapshot().dialog.position, null);
  assert.equal(store.getSnapshot().dialog.status, "live");
  assert.equal(sockets, 1, "an initial delay read shares the existing socket");
  push({ ...point(0), position: null });
  assert.equal(store.getSnapshot().dialog.delaySeconds, 0);
  manager.dispose();
});

test("temporary missing and older socket samples preserve fresh delay until its original expiry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let push!: (data: unknown) => void;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    socket: (options) => {
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "dialog", data });
      return { connect() {}, send: () => true, close() {} };
    },
  });
  manager.setIds(["dialog"]);
  await setImmediate();
  push(point(240));
  const received = store.getSnapshot().dialog;
  t.mock.timers.tick(10000);
  push({ status: "unavailable" });
  assert.equal(store.getSnapshot().dialog, received);
  push({
    ...point(120),
    observed_at: new Date(Date.now() - 11000).toISOString(),
    valid_until: new Date(Date.now() + 19000).toISOString(),
  });
  assert.equal(store.getSnapshot().dialog, received);
  t.mock.timers.tick(20000);
  assert.equal(store.getSnapshot().dialog.status, "stale");
  assert.equal(store.getSnapshot().dialog.delaySeconds, null);
  manager.dispose();
});

test("a missing HTTP sample preserves an earlier socket point until its original expiry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  let push!: (data: unknown) => void;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    observation: async () => ({ status: "unavailable" }),
    socket: (options) => {
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "dialog", data });
      return { connect() {}, send: () => true, close() {} };
    },
  });
  manager.setIds(["dialog"]);
  await setImmediate();
  push(point(240));
  const received = store.getSnapshot().dialog;
  t.mock.timers.tick(10000);
  manager.refresh("dialog");
  await setImmediate();
  assert.equal(store.getSnapshot().dialog, received);
  t.mock.timers.tick(20000);
  assert.equal(store.getSnapshot().dialog.status, "stale");
  assert.equal(store.getSnapshot().dialog.position, null);
  manager.dispose();
});

test("an HTTP point works without a socket and keeps its expiry while the socket connects", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  for (const status of ["available", "unsupported"] as const) {
    let issue!: (value: TrackingSession) => void;
    const store = createTrackingStore();
    const manager = createTrackingSubscriptions(store, {
      tracking: () => new Promise((resolve) => (issue = resolve)),
      observation: async () => point(),
      socket: () => ({ connect() {}, send: () => true, close() {} }),
    });
    manager.setIds(["dialog"]);
    manager.refresh("dialog");
    await setImmediate();
    issue({
      status,
      url: "ws://localhost",
      ticket: "one",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    });
    await setImmediate();
    assert.equal(store.getSnapshot().dialog.status, "live");
    t.mock.timers.tick(30000);
    assert.equal(store.getSnapshot().dialog.status, "stale");
    manager.dispose();
  }
});

test("shared initial reads are deduplicated and closing prevents late responses from repopulating the store", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const pending: { signal: AbortSignal; resolve: (value: unknown) => void }[] =
    [];
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({ status: "unsupported" }),
    observation: (_id, signal) =>
      new Promise((resolve) => pending.push({ signal, resolve })),
    socket: () => {
      throw Error("not connected");
    },
  });
  manager.setIds(["dialog"]);
  manager.refresh("dialog");
  manager.refresh("dialog");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].signal.aborted, false);
  manager.setIds([]);
  assert.equal(pending[0].signal.aborted, true);
  manager.setIds(["dialog"]);
  manager.refresh("dialog");
  pending[0].resolve(point(480));
  pending[1].resolve(point(120));
  await setImmediate();
  assert.equal(store.getSnapshot().dialog.delaySeconds, 120);
  manager.setIds([]);
  manager.setIds(["dialog"]);
  manager.refresh("dialog");
  manager.setIds([]);
  assert.equal(pending[2].signal.aborted, true);
  pending[2].resolve(point());
  await setImmediate();
  assert.equal(store.getSnapshot().dialog, undefined);
  manager.dispose();
});

test("multiple trips share one socket, unsubscribe independently and renew without reconnecting", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const requests: string[] = [],
    sent: any[] = [];
  let sockets = 0,
    closed = 0;
  let push!: (trip: string, data: unknown) => void;
  const store = createTrackingStore();
  const manager = createTrackingSubscriptions(store, {
    tracking: async (id): Promise<TrackingSession> => {
      requests.push(id);
      return {
        status: "available",
        url: "ws://localhost",
        ticket: id + requests.length,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };
    },
    socket: (options) => {
      sockets++;
      push = (trip, data) =>
        options.onMessage?.({ type: "observation", trip, data });
      return {
        connect() {
          options.onState?.("open");
        },
        send(message) {
          sent.push(message);
          return true;
        },
        close() {
          closed++;
          options.onState?.("closed");
        },
      };
    },
  });
  manager.setIds(["a"]);
  await setImmediate();
  manager.setIds(["a", "b", "a"]);
  assert.deepEqual(requests, ["a"]);
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b"]);
  assert.equal(sockets, 1);
  push("a", point(60));
  push("b", point(120));
  assert.equal(store.getSnapshot().a.delaySeconds, 60);
  assert.equal(store.getSnapshot().b.delaySeconds, 120);
  manager.setIds(["a"]);
  assert.equal(store.getSnapshot().b, undefined);
  assert.deepEqual(sent.at(-1), { type: "unsubscribe", trip: "b" });
  assert.equal(closed, 0);
  push("b", point());
  assert.equal(
    store.getSnapshot().b,
    undefined,
    "late frames cannot resurrect a removed trip",
  );
  manager.setIds(["a", "b"]);
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b", "b"]);
  assert.equal(sockets, 1);
  t.mock.timers.tick(598000);
  await setImmediate();
  manager.setIds(["a", "b"]);
  assert.equal(requests.length, 3, "ten minutes do not trigger ticket renewal");
  t.mock.timers.tick(270000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b", "b", "a"]);
  assert.equal(
    sockets,
    1,
    "ticket renewal subscribes over the original socket",
  );
  assert.equal(closed, 0);
  manager.setIds([]);
  assert.equal(closed, 1);
  manager.dispose();
  t.mock.timers.tick(900000);
  await setImmediate();
  assert.equal(requests.length, 4);
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

test("a dropped shared socket obtains fresh tickets for all trips over one replacement connection", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const requests: string[] = [],
    sent: string[] = [];
  let sockets = 0,
    closed = 0;
  let drop!: () => void;
  const manager = createTrackingSubscriptions(createTrackingStore(), {
    tracking: async (id) => {
      requests.push(id);
      return {
        status: "available",
        url: "ws://localhost",
        ticket: `${id}-${requests.length}`,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      };
    },
    socket: (options) => {
      sockets++;
      drop = () => options.onState?.("closed");
      return {
        connect() {
          options.onState?.("open");
        },
        send(value) {
          const message = value as { type: string; ticket: string };
          if (message.type === "subscribe") sent.push(message.ticket);
          return true;
        },
        close() {
          closed++;
          options.onState?.("closed");
        },
      };
    },
  });
  manager.setIds(["a", "b"]);
  await setImmediate();
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.equal(sockets, 1);
  drop();
  assert.equal(closed, 1);
  t.mock.timers.tick(1000);
  await setImmediate();
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.deepEqual(requests, ["a", "b", "a", "b"]);
  assert.deepEqual(sent, ["a-1", "b-2", "a-3", "b-4"]);
  assert.equal(sockets, 2, "two watched trips produce one replacement socket");
  assert.equal(closed, 1);
  manager.dispose();
  assert.equal(closed, 2);
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

test("online trip aliases share one socket and update their own delay and GPS without borrowing native timetable progress", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  const store = createTrackingStore();
  let sockets = 0;
  let push!: (data: unknown) => void;
  const sent: unknown[] = [];
  const manager = createTrackingSubscriptions(store, {
    tracking: async () => ({
      status: "available",
      tripId: "native-trip",
      url: "ws://localhost",
      ticket: "ticket",
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    }),
    observation: async () => point(60),
    socket: (options) => {
      sockets++;
      push = (data) =>
        options.onMessage?.({ type: "observation", trip: "native-trip", data });
      return {
        connect() {
          options.onState?.("open");
        },
        close() {},
        send(value) {
          sent.push(value);
          return true;
        },
      };
    },
  });
  manager.setIds(["online-trip"]);
  manager.refresh("online-trip");
  await setImmediate();
  assert.equal(store.getSnapshot()["online-trip"].delaySeconds, 60);
  push(point(180));
  assert.equal(store.getSnapshot()["online-trip"].delaySeconds, 180);
  assert.equal(store.getSnapshot()["online-trip"].position?.lat, 50);
  push({
    ...point(),
    status: "estimated",
    position: null,
    delay_seconds: null,
    cancelled: null,
  });
  assert.equal(store.getSnapshot()["online-trip"].delaySeconds, 180);
  assert.equal(store.getSnapshot()["online-trip"].position?.lat, 50);
  assert.equal(store.getSnapshot()["native-trip"], undefined);
  assert.equal(sockets, 1);
  manager.setIds(["online-trip", "another-segment"]);
  t.mock.timers.tick(1000);
  await setImmediate();
  push(point(240));
  assert.equal(store.getSnapshot()["another-segment"].delaySeconds, 240);
  manager.setIds(["another-segment"]);
  assert.equal(
    sent.filter((item) => (item as { type: string }).type === "unsubscribe")
      .length,
    0,
    "removing one segment keeps the shared native subscription",
  );
  push(point(300));
  assert.equal(store.getSnapshot()["another-segment"].delaySeconds, 300);
  assert.equal(sockets, 1);
  manager.setIds([]);
  assert.ok(
    sent.some(
      (item) =>
        JSON.stringify(item) ===
        JSON.stringify({ type: "unsubscribe", trip: "native-trip" }),
    ),
  );
  manager.dispose();
});
