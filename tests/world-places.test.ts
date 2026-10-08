import test from "node:test";
import assert from "node:assert/strict";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import { places } from "../src/modules/TransportModule/server/handlers";
import type { CoreClient } from "../src/modules/CoreModule/server/php-core";

const country = (state: string) => ({
  state,
  capabilities: ["places"],
  search_available: true,
  cities_available: true,
});
test("server World federation uses registered countries, keeps healthy results and reports partial outage", async () => {
  const requests: string[] = [];
  const core = {
    request: async (path: string, options?: any) => {
      if (path.endsWith("coverage"))
        return {
          countries: [
            country("CZ"),
            country("SK"),
            country("DE"),
            { ...country("AT"), search_available: false },
          ],
        };
      const state = options.body.q.state;
      requests.push(state);
      assert.equal(options.body.q.city, undefined);
      if (state === "SK") throw new Error("upstream outage");
      return {
        data: [
          {
            id: state,
            name: "Grohova",
            state,
            kind: "stop",
            lat: 49.2,
            lon: 16.6,
          },
          { id: "foreign", name: "Foreign", state: "XX" },
        ],
      };
    },
  } as CoreClient;
  const result = await createTransportProvider(core).worldPlaces("groh");
  assert.deepEqual(requests, ["CZ", "SK", "DE"]);
  assert.deepEqual(
    result.data.map((p) => p.id),
    ["CZ", "DE"],
  );
  assert.equal(result.partial, true);
});
test("World fails explicitly if every catalogue fails", async () => {
  const core = {
    request: async (path: string) => {
      if (path.endsWith("coverage")) return { countries: [country("CZ")] };
      throw new Error("unavailable");
    },
  } as CoreClient;
  await assert.rejects(
    createTransportProvider(core).worldPlaces("groh"),
    /unavailable/,
  );
});
test("public World scope rejects arbitrary scopes and contradictory country/city before querying", async () => {
  for (const query of [
    { scope: "other" },
    { scope: "world", state: "CZ" },
    { scope: "world", city: "Brno" },
  ]) {
    const url = new URL(
      "http://localhost/api/transport/places/?q=" +
        encodeURIComponent(
          JSON.stringify({ name: { $regex: "groh" }, ...query }),
        ),
    );
    const result = await places({
      url,
      request: new Request(url),
      locals: {
        providers: {
          transport: {
            worldPlaces: () => {
              throw new Error("must not query");
            },
          },
        },
      },
    } as any);
    assert.equal(result.status, 422);
  }
});

test("public World endpoint delegates once and does not cache place queries", async () => {
  let calls = 0;
  const url = new URL(
    "http://localhost/api/transport/places/?q=" +
      encodeURIComponent(
        JSON.stringify({ scope: "world", name: { $regex: "Groh" } }),
      ),
  );
  const response = await places({
    url,
    request: new Request(url),
    locals: {
      providers: {
        transport: {
          worldPlaces: async (query: string, location: unknown) => {
            calls++;
            assert.equal(query, "Groh");
            assert.equal(location, undefined);
            return { data: [], partial: false };
          },
        },
      },
    },
  } as any);
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
