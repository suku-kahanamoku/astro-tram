import test from "node:test";
import assert from "node:assert/strict";
import { cities } from "../src/modules/TransportModule/server/handlers";
import { transportClient } from "../src/modules/TransportCoreModule/providers/client";

function context(request: Request, calls: unknown[][]) {
  return {
    request,
    url: new URL(request.url),
    locals: {
      providers: {
        transport: {
          cities: async (...args: unknown[]) => {
            calls.push(args);
            return {
              data: [{ id: "brno", name: "Brno", state: "CZ" }],
              partial: false,
            };
          },
        },
      },
    },
  } as unknown as Parameters<typeof cities>[0];
}

test("city GPS uses a private POST body, fresh complete coordinates and no cache", async () => {
  const calls: unknown[][] = [];
  const observed_at = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/\.\d{3}Z$/, "Z");
  const response = await cities(
    context(
      new Request("https://tram.test/api/transport/cities/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: { state: "CZ", latitude: 49.2, longitude: 16.6, observed_at },
        }),
      }),
      calls,
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(calls, [
    ["CZ", { lat: 49.2, lon: 16.6, observedAt: observed_at }],
  ]);
  for (const q of [
    { state: "CZ", latitude: 49.2 },
    {
      state: "CZ",
      latitude: 49.2,
      longitude: 16.6,
      observed_at: "2000-01-01T00:00:00Z",
    },
    { state: "CZ", latitude: 91, longitude: 16.6, observed_at },
  ]) {
    assert.equal(
      (
        await cities(
          context(
            new Request("https://tram.test/api/transport/cities/", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ q }),
            }),
            calls,
          ),
        )
      ).status,
      422,
    );
  }
  const q = encodeURIComponent(
    JSON.stringify({
      state: "CZ",
      latitude: 49.2,
      longitude: 16.6,
      observed_at,
    }),
  );
  assert.equal(
    (
      await cities(
        context(
          new Request(`https://tram.test/api/transport/cities/?q=${q}`),
          calls,
        ),
      )
    ).status,
    422,
  );
  assert.equal(calls.length, 1);
});

test("browser city client never puts GPS in URLs and preserves backend order", async () => {
  const old = globalThis.fetch;
  const fix = {
    lat: 49.2,
    lon: 16.6,
    observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "/api/transport/cities/");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), {
      q: {
        state: "CZ",
        latitude: fix.lat,
        longitude: fix.lon,
        observed_at: fix.observedAt,
      },
    });
    return Response.json({
      success: true,
      data: [{ name: "Z capital" }, { name: "A town" }],
    });
  };
  try {
    assert.deepEqual(
      (
        await transportClient.cities("CZ", new AbortController().signal, fix)
      ).map((city) => city.name),
      ["Z capital", "A town"],
    );
  } finally {
    globalThis.fetch = old;
  }
});
