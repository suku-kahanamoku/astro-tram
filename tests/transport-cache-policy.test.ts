import test from "node:test";
import assert from "node:assert/strict";
import {
  transportClient,
  TransportRequestError,
} from "../src/modules/TransportCoreModule/providers/client";

test("browser deduplicates public metadata but always reloads GPS, search, realtime and delay", async () => {
  const original = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  const calls: { path: string; options?: RequestInit }[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ path: String(url), options });
    return Response.json({ success: true, data: { value: "static" } });
  };
  const signal = new AbortController().signal;
  try {
    await Promise.all([
      transportClient.coverage(signal),
      transportClient.coverage(signal),
    ]);
    await transportClient.coverage(signal);
    assert.equal(calls.length, 1);
    for (let i = 0; i < 2; i++) {
      await transportClient.search({ from: "stop", to: "stop" }, signal);
      await transportClient.observation("live-trip", signal);
      await transportClient.tracking("live-trip", signal);
      await transportClient.cities("CZ", signal, {
        lat: 49.2,
        lon: 16.6,
        observedAt: "2026-10-09T12:00:00Z",
      });
      await transportClient.places(
        { latitude: 49.2, longitude: 16.6 },
        signal,
        true,
      );
    }
    assert.equal(calls.length, 11);
    const privateCalls = calls.filter(
      ({ path }) => path.endsWith("/cities/") || path.endsWith("/places/"),
    );
    assert.ok(
      privateCalls.every(
        ({ options }) => options?.method === "POST" && options.body,
      ),
    );
    assert.ok(calls.every(({ options }) => options?.cache === "no-store"));
    assert.ok(
      calls.every(({ path }) => !/latitude|longitude|observed_at/.test(path)),
    );
    globalThis.fetch = async () =>
      Response.json({ success: true, data: { stops: [], delaySeconds: 60 } });
    const live = await transportClient.trip("has-delay", signal);
    globalThis.fetch = async () =>
      Response.json({ success: true, data: { stops: [], delaySeconds: 120 } });
    assert.notDeepEqual(await transportClient.trip("has-delay", signal), live);
  } finally {
    globalThis.fetch = original;
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("transport preserves Retry-After and domain error identity through Core HTTP handling", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { success: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "5" } },
    );
  try {
    await assert.rejects(
      transportClient.observation("trip", new AbortController().signal),
      (error: unknown) =>
        error instanceof TransportRequestError &&
        error.status === 429 &&
        error.retryAfterMs === 5000 &&
        error.message === "rate_limited",
    );
  } finally {
    globalThis.fetch = original;
  }
});
