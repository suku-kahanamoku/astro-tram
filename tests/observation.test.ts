import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import { observation } from "../src/modules/TransportModule/server/handlers";

test("initial GPS goes through the fixed tenant gateway and exposes only observation fields", async () => {
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://core.test",
        apiKey: "secret",
        tenantHost: "tram.test",
      },
      async (url, options) => {
        assert.equal(
          new URL(String(url)).pathname,
          "/transport/v1/trips/trip_id/observation",
        );
        assert.equal(
          new Headers(options?.headers).get("X-Internal-Key"),
          "secret",
        );
        assert.equal(
          new Headers(options?.headers).get("X-Forwarded-Host"),
          "tram.test",
        );
        return Response.json({
          success: true,
          data: {
            status: "last_known",
            position: { lat: 50, lon: 14, private_key: "secret" },
            observed_at: "2026-10-02T18:00:00Z",
            valid_until: "2026-10-02T18:01:30Z",
            delay_seconds: null,
            cancelled: null,
            private_key: "secret",
            stops: ["private"],
          },
        });
      },
    ),
  );
  const result = await observation({
    url: new URL("https://tram.test/api/transport/observation/?id=trip_id"),
    locals: { providers: { transport: provider } },
  } as any);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  const json = await result.json();
  assert.deepEqual(json.data, {
    status: "last_known",
    position: { lat: 50, lon: 14 },
    observed_at: "2026-10-02T18:00:00Z",
    valid_until: "2026-10-02T18:01:30Z",
    delay_seconds: null,
    cancelled: null,
  });
});

test("invalid trip IDs are rejected before calling the backend", async () => {
  const response = await observation({
    url: new URL("https://tram.test/api/transport/observation/?id=../../other"),
    locals: {},
  } as any);
  assert.equal(response.status, 422);
});

test("the initial observation gateway returns verified delay even when GPS is unavailable", async () => {
  const sample = {
    status: "live",
    position: null,
    observed_at: "2026-10-03T10:00:00Z",
    valid_until: "2026-10-03T10:00:30Z",
    delay_seconds: 480,
    cancelled: false,
  };
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
          data: { ...sample, private_key: "secret" },
        }),
    ),
  );
  const response = await observation({
    url: new URL("https://tram.test/api/transport/observation/?id=trip_id"),
    locals: { providers: { transport: provider } },
  } as any);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).data, sample);
});
