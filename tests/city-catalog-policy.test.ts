import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";

test("city catalogues revalidate at the backend after schedule generation changes", async () => {
  let revision = 1;
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://cities.example.test",
        apiKey: "key",
        tenantHost: "tram.test",
      },
      async () =>
        Response.json({
          success: true,
          data: {
            data: [{ id: `generation-${revision}`, name: "Brno", state: "CZ" }],
          },
        }),
    ),
  );
  assert.equal((await provider.cities("CZ")).data[0].id, "generation-1");
  revision++;
  assert.equal((await provider.cities("CZ")).data[0].id, "generation-2");
});

test("GPS city order comes from Java without alphabetical override or caching user positions", async () => {
  const queries: Record<string, unknown>[] = [];
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://city-ranking.example.test",
        apiKey: "ranking-key",
        tenantHost: "tram.test",
      },
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        queries.push(body);
        assert.equal(body.sort, undefined);
        return Response.json({
          success: true,
          data: {
            data: [
              {
                id: "z",
                name: "Z capital",
                state: "CZ",
                regional_capital: true,
                capital_regions: ["Local"],
              },
              { id: "a", name: "A city", state: "CZ" },
            ],
          },
        });
      },
    ),
  );
  const fix = { lat: 49.2, lon: 16.6, observedAt: new Date().toISOString() };
  const first = await provider.cities("CZ", fix);
  await provider.cities("CZ", fix);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0].q as Record<string, unknown>, {
    state: "CZ",
    latitude: fix.lat,
    longitude: fix.lon,
    observed_at: fix.observedAt,
  });
  assert.deepEqual(
    first.data.map((city) => city.name),
    ["Z capital", "A city"],
  );
  assert.equal(first.data[0].regionalCapital, true);
  assert.deepEqual(first.data[0].capitalRegions, ["Local"]);
  await provider.cities("CZ");
  await provider.cities("CZ");
  assert.equal(queries.length, 4);
  assert.deepEqual(queries[2].q, { state: "CZ" });
});
