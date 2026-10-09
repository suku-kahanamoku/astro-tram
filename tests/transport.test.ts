import test from "node:test";
import assert from "node:assert/strict";
import {
  readState,
  writeState,
  searchBody,
  requiresLocation,
  formInstant,
} from "../src/modules/TransportCoreModule/providers/state";
import { validateSearch } from "../src/modules/TransportModule/server/handlers";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import { escapeHtml } from "../src/modules/TransportJourneyModule/providers/render";
import type { SearchState } from "../src/modules/TransportCoreModule/types";
const state: SearchState = {
  from: { type: "stop", id: "stop_1", label: "Praha, Muzeum" },
  to: { type: "coordinates", lat: 50.1, lon: 14.2, label: "Mapa" },
  at: "2026-10-06T08:00:00Z",
  arrive: true,
  direct: true,
  country: "CZ",
};
test("search URL preserves places, map coordinates, instant, arrival and direct mode", () => {
  assert.deepEqual(readState(writeState(state)), state);
  const body = searchBody(state);
  assert.equal(body["to-date"], state.at);
  assert.equal(body["max-transfers"], 0);
  assert.equal(body["from-date"], undefined);
  assert.equal((body["from-dest"] as any).label, undefined);
  assert.deepEqual(body["to-dest"], {
    type: "coordinates",
    lat: 50.1,
    lon: 14.2,
    name: "Mapa",
  });
  assert.deepEqual(validateSearch(body)["to-dest"], body["to-dest"]);
});
test("coordinate place names remain bounded display labels without changing routing coordinates", () => {
  const body = searchBody({
    ...state,
    from: {
      type: "coordinates",
      lat: 49.2076651,
      lon: 16.5814115,
      label: "Eleonory Voračické",
    },
  });
  assert.deepEqual(validateSearch(body)["from-dest"], {
    type: "coordinates",
    lat: 49.2076651,
    lon: 16.5814115,
    name: "Eleonory Voračické",
  });
  for (const name of [3, "", "x".repeat(251), "bad\nname"])
    assert.throws(() =>
      validateSearch({
        ...body,
        "from-dest": {
          type: "coordinates",
          lat: 49.2076651,
          lon: 16.5814115,
          name,
        },
      }),
    );
});
test("current GPS is reacquired and never serialized into URL state", () => {
  const current: SearchState = {
    ...state,
    from: { type: "current_location", label: "Moje poloha" },
  };
  const url = writeState(current).toString();
  assert.ok(
    !url.includes("fromLat") &&
      !url.includes("observed") &&
      !url.includes("Moje"),
  );
  assert.throws(() => searchBody(current), /stale/);
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const body = searchBody(current, { lat: 50, lon: 14, observedAt: at });
  assert.equal((body["from-dest"] as any)["observed-at"], at);
  assert.throws(
    () =>
      searchBody(current, {
        lat: 50,
        lon: 14,
        observedAt: "2020-01-01T00:00:00Z",
      }),
    /stale/,
  );
});
test("invalid coordinate and date input is rejected before upstream", () => {
  assert.equal(
    readState(
      new URLSearchParams("fromKind=coordinates&fromLat=200&fromLon=14"),
    ).from,
    undefined,
  );
  assert.throws(() => formInstant("2026-02-30", "10:00"));
  assert.throws(() =>
    validateSearch({ ...searchBody(state), url: "https://evil.test" }),
  );
  assert.throws(() =>
    validateSearch({
      ...searchBody(state),
      "to-dest": { type: "coordinates", lat: Infinity, lon: 14 },
    }),
  );
  assert.throws(
    () =>
      validateSearch({
        ...searchBody(state),
        "from-dest": {
          type: "current_location",
          lat: 50,
          lon: 14,
          "observed-at": "2020-01-01T00:00:00Z",
        },
      }),
    { code: "stale_location" },
  );
});
test("provider uses fixed tenant, structured query and response field whitelist", async () => {
  const config = {
    baseUrl: "https://core.test/api",
    apiKey: "secret",
    tenantHost: "tram.test",
  };
  const provider = createTransportProvider(
    createCoreClient(config, async (url, options) => {
      const u = new URL(String(url));
      assert.equal(u.pathname, "/api/transport/v1/places/search");
      assert.equal(
        JSON.parse(options!.body as string).q.name.$regex,
        "Praha & okolí",
      );
      assert.equal(
        new Headers(options?.headers).get("X-Forwarded-Host"),
        "tram.test",
      );
      return Response.json({
        success: true,
        data: {
          data: [
            {
              id: "abc_DEF",
              name: "Praha",
              lat: 50,
              lon: 14,
              source_mode: "live",
              secret: "do not expose",
            },
          ],
        },
      });
    }),
  );
  const result = await provider.places("Praha & okolí", "CZ");
  assert.deepEqual(result.data, [
    {
      id: "abc_DEF",
      name: "Praha",
      lat: 50,
      lon: 14,
      platform: null,
      sourceMode: "live",
      city: null,
    },
  ]);
});
test("known transport errors survive without leaking arbitrary upstream messages", async () => {
  const core = createCoreClient(
    {
      baseUrl: "https://core.test/api",
      apiKey: "secret",
      tenantHost: "tram.test",
    },
    async () =>
      Response.json(
        {
          success: false,
          errors: { code: "unsupported_coverage" },
          message: "private-key",
        },
        { status: 422 },
      ),
  );
  await assert.rejects(() => core.request("/transport/v1/journeys/search"), {
    code: "unsupported_coverage",
    status: 422,
  });
});
test("remote strings are escaped before HTML rendering", () => {
  assert.equal(
    escapeHtml('<img onerror="alert(1)">'),
    "&lt;img onerror=&quot;alert(1)&quot;&gt;",
  );
});

test("no configured place sources is not presented as a successful empty search", async () => {
  const provider = (sources: unknown[]) =>
    createTransportProvider(
      createCoreClient(
        {
          baseUrl: "https://core.test/api",
          apiKey: "secret",
          tenantHost: "tram.test",
        },
        async () =>
          Response.json({
            success: true,
            data: { data: [], partial: false, sources },
          }),
      ),
    );
  await assert.rejects(() => provider([]).places("Tabor", "CZ"), {
    code: "places_not_configured",
    status: 503,
  });
  assert.deepEqual(
    await provider([{ provider: "pid", status: "ok" }]).places("Tabor", "CZ"),
    { data: [], partial: false },
  );
});

test("legacy GPS scope links do not request device location or survive URL serialization", () => {
  const params = writeState(state);
  params.set("scopeLocation", "1");
  const restored = readState(params);
  assert.equal(requiresLocation(restored), false);
  assert.equal(writeState(restored).has("scopeLocation"), false);
  assert.equal(searchBody(restored).location, undefined);
});

test("coverage BFF exposes only validated tenant country capabilities", async () => {
  const provider = (countries: unknown) =>
    createTransportProvider(
      createCoreClient(
        {
          baseUrl: "https://core.test/api",
          apiKey: "secret",
          tenantHost: "tram.test",
        },
        async (url, options) => {
          assert.equal(
            new URL(String(url)).pathname,
            "/api/transport/v1/coverage",
          );
          assert.equal(
            new Headers(options?.headers).get("X-Forwarded-Host"),
            "tram.test",
          );
          return Response.json({
            success: true,
            data: { countries, providers: [{ secret: "PRIVATE" }] },
          });
        },
      ),
    );
  const country = {
    state: "AT",
    capabilities: ["stop", "departures"],
    search_available: false,
    cities_available: false,
    secret: "PRIVATE",
  };
  assert.deepEqual(await provider([country]).coverage(), [
    {
      state: "AT",
      capabilities: ["stop", "departures"],
      searchAvailable: false,
      citiesAvailable: false,
    },
  ]);
  for (const malformed of [
    null,
    [country, country],
    [{ ...country, state: "Austria" }],
    [{ ...country, capabilities: [7] }],
    [{ ...country, search_available: "yes" }],
  ])
    await assert.rejects(() => provider(malformed).coverage(), {
      code: "invalid_backend_response",
    });
});

test("trip BFF maps allowed equipment and technical notes without exposing unknown provider fields", async () => {
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://core.test/api",
        apiKey: "secret",
        tenantHost: "tram.test",
      },
      async () =>
        Response.json({
          success: true,
          data: {
            result: {
              stops: [],
              metadata: {
                features: ["WIFI", "WIFI", "BICYCLE_TRANSPORT", "UNRECOGNIZED"],
                accessibility: "partial",
                reservations: {
                  bicycle: "mandatory",
                  passenger: "available",
                  luggage: "NONE",
                  private: "available",
                },
                notes: [
                  {
                    scope: "line",
                    category: "technical",
                    texts: { cs: "Grafikony: PD: T2610" },
                  },
                ],
                vehicle_position: { latitude: 50 },
                secret: "DO_NOT_EXPOSE",
              },
            },
            source: { mode: "live" },
          },
        }),
    ),
  );
  const trip = await provider.trip("TEST");
  assert.deepEqual(trip.metadata?.features, ["WIFI", "BICYCLE_TRANSPORT"]);
  assert.equal(trip.metadata?.accessibility, "partial");
  assert.deepEqual(trip.metadata?.reservations, {
    bicycle: "mandatory",
    passenger: "available",
  });
  assert.equal(trip.metadata?.notes[0].category, "technical");
  assert.doesNotMatch(
    JSON.stringify(trip),
    /DO_NOT_EXPOSE|vehicle_position|UNRECOGNIZED/,
  );
});
