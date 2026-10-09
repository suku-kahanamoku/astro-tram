import test from "node:test";
import assert from "node:assert/strict";
import { selectPlace } from "../src/modules/TransportCoreModule/providers/placeSelection";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";

test("geography selection keeps transit IDs and uses coordinates for streets and addresses", () => {
  const option = {
    id: "public_id",
    name: "Česká",
    lat: 49.2,
    lon: 16.6,
    platform: null,
    sourceMode: "index",
  };
  assert.deepEqual(selectPlace({ ...option, kind: "stop" }), {
    type: "stop",
    id: option.id,
    label: option.name,
  });
  for (const kind of ["street", "address"] as const)
    assert.deepEqual(selectPlace({ ...option, kind }), {
      type: "coordinates",
      lat: 49.2,
      lon: 16.6,
      label: "Česká",
    });
  assert.deepEqual(selectPlace({ ...option, kind: "city", state: "CZ" }), {
    type: "municipality",
    id: option.id,
    label: option.name,
    lat: 49.2,
    lon: 16.6,
    state: "CZ",
  });
  assert.equal(
    selectPlace({ ...option, kind: "street", lat: null }),
    undefined,
  );
});

test("geography projection drops private fields and invalid map points", async () => {
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
            data: [
              {
                id: "street",
                name: "Česká",
                kind: "street",
                city_source: "nearest_settlement",
                city: "Brno",
                lat: 49.2,
                lon: 16.6,
                token: "private",
              },
              {
                id: "invalid",
                name: "Invalid",
                kind: "address",
                lat: null,
                lon: null,
              },
            ],
          },
        }),
    ),
  );
  const result = await provider.places("ces", "CZ");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].kind, "street");
  assert.equal(result.data[0].citySource, "nearest_settlement");
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("search results retain resolved named coordinate endpoints without a transit ID", async () => {
  const from = {
    type: "coordinates",
    name: "Eleonory Voračické",
    lat: 49.2076651,
    lon: 16.5814115,
  };
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
          data: { journeys: [], resolved_places: { from } },
        }),
    ),
  );
  const result = await provider.search({});
  assert.equal(result.resolvedPlaces?.from?.name, from.name);
  assert.equal(result.resolvedPlaces?.from?.id, null);
  assert.equal(result.resolvedPlaces?.from?.lat, from.lat);
});
