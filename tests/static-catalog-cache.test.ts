import test from "node:test";
import assert from "node:assert/strict";
import { createStaticCatalogCache } from "../src/modules/TransportModule/server/staticCatalogCache";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";

test("public static catalogues join pending reads, clone results, expire and retry failures", async () => {
  let now = 0,
    reads = 0;
  const cache = createStaticCatalogCache(() => now, 30, 2, 1000);
  let release!: (value: { name: string }) => void;
  const load = () => {
    reads++;
    return new Promise<{ name: string }>((resolve) => {
      release = resolve;
    });
  };
  const a = cache.get("tenant:CZ", load),
    b = cache.get("tenant:CZ", load);
  await Promise.resolve();
  assert.equal(reads, 1);
  release({ name: "Brno" });
  const first = await a;
  first.name = "Changed";
  assert.deepEqual(await b, { name: "Brno" });
  assert.deepEqual(
    await cache.get("tenant:CZ", async () => {
      throw new Error("must not fetch");
    }),
    { name: "Brno" },
  );
  now = 31;
  await assert.rejects(
    cache.get("tenant:CZ", async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
  assert.deepEqual(
    await cache.get("tenant:CZ", async () => ({ name: "Praha" })),
    { name: "Praha" },
  );
});

test("city cache is shared across request providers but isolated by credential, tenant and country", async () => {
  let reads = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    reads++;
    const country = JSON.parse(String(init?.body)).q.state;
    return Response.json({
      success: true,
      data: {
        data: [{ id: "city", name: country, state: country }],
        has_more: false,
      },
    });
  };
  const config = {
    baseUrl: "https://catalogue.example.test",
    apiKey: "catalogue-key",
    tenantHost: "tram.test",
  };
  const provider = () =>
    createTransportProvider(createCoreClient(config, fetcher));
  await Promise.all([provider().cities("CZ"), provider().cities("CZ")]);
  assert.equal(reads, 1);
  await provider().cities("SK");
  assert.equal(reads, 2);
  await createTransportProvider(
    createCoreClient({ ...config, tenantHost: "other.test" }, fetcher),
  ).cities("CZ");
  await createTransportProvider(
    createCoreClient({ ...config, apiKey: "other-key" }, fetcher),
  ).cities("CZ");
  assert.equal(reads, 4);
});

test("static cache obeys entry and byte limits", async () => {
  const tiny = createStaticCatalogCache(() => 0, 30, 1, 1);
  let reads = 0;
  const load = async () => {
    reads++;
    return { name: "Brno" };
  };
  await tiny.get("a", load);
  await tiny.get("a", load);
  assert.equal(reads, 2);
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
  assert.equal(queries.length, 3);
  assert.deepEqual(queries[2].q, { state: "CZ" });
});
