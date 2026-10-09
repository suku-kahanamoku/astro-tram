import test from "node:test";
import assert from "node:assert/strict";
import { chooseTypedPlace } from "../src/modules/TransportSearchModule/providers/placeSuggestions";
import { rankWorldPlaces } from "../src/modules/TransportCoreModule/providers/placeRanking";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import type {
  PlaceOption,
  SearchState,
} from "../src/modules/TransportCoreModule/types";
const state: SearchState = { country: "CZ", arrive: false, direct: false };
const option = (
  id: string,
  name: string,
  patch: Partial<PlaceOption> = {},
): PlaceOption => ({
  id,
  name,
  kind: "stop",
  state: "CZ",
  lat: 49.2,
  lon: 16.6,
  sourceMode: "index",
  ...patch,
});
test("unselected exact city chooses a backend main station even if GPS puts a district first", () => {
  for (const city of ["Brno", "Praha", "Tábor", "Łódź", "Berlin"]) {
    const district = option("near", `${city}, park`);
    const station = option("main", `${city}, main station`, {
      cityStation: true,
      matchedCity: city,
      stationPriority: 0,
    });
    const text =
      city === "Tábor"
        ? "tabor"
        : city === "Łódź"
          ? "lodz"
          : city.toLowerCase();
    assert.equal(
      chooseTypedPlace(text, state, [district, station])?.id,
      "main",
    );
    assert.equal(
      chooseTypedPlace(text, { ...state, city }, [district, station])?.id,
      "near",
    );
    assert.equal(
      chooseTypedPlace("park", state, [district, station])?.id,
      "near",
    );
  }
});
test("World preserves backend station priority before exact text and nearby GPS matches", () => {
  const exact = option("near", "Tábor", { lat: 49.2, lon: 16.6 });
  const main = option("main", "Tábor, hlavní nádraží", {
    cityStation: true,
    matchedCity: "Tábor",
    stationPriority: 0,
    lat: 50,
    lon: 14,
  });
  const bus = option("bus", "Tábor, autobusové nádraží", {
    cityStation: true,
    matchedCity: "Tábor",
    stationPriority: 1,
  });
  const street = option("street", "Tábor", { kind: "street" });
  assert.deepEqual(
    rankWorldPlaces([street, exact, bus, main], "tabor", {
      lat: 49.2,
      lon: 16.6,
      observedAt: "2026-10-09T12:00:00Z",
    }).map((p) => p.id),
    ["main", "bus", "near", "street"],
  );
  assert.equal(rankWorldPlaces([exact, main], "park")[0].id, "near");
});
test("public projection keeps verified station metadata and drops invalid or private fields", async () => {
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
                id: "main",
                name: "Brno, hlavní nádraží",
                kind: "stop",
                state: "CZ",
                city_station: true,
                matched_city: "Brno",
                station_priority: 0,
                secret: "private",
              },
              {
                id: "bad",
                name: "Invalid",
                kind: "street",
                city_station: true,
                matched_city: "Brno",
                station_priority: 0,
                lat: 49,
                lon: 16,
              },
            ],
          },
        }),
    ),
  );
  const result = await provider.places("brno", "CZ");
  assert.equal(result.data[0].cityStation, true);
  assert.equal(result.data[0].matchedCity, "Brno");
  assert.equal(result.data[0].stationPriority, 0);
  assert.equal(result.data[1].cityStation, undefined);
  assert.ok(!JSON.stringify(result).includes("private"));
});
