import test from "node:test";
import assert from "node:assert/strict";
import { chooseTypedPlace } from "../src/modules/TransportSearchModule/providers/placeSuggestions";
import { selectPlace } from "../src/modules/TransportCoreModule/providers/placeSelection";
import { rankWorldPlaces } from "../src/modules/TransportCoreModule/providers/placeRanking";
import {
  readState,
  writeState,
  searchBody,
} from "../src/modules/TransportCoreModule/providers/state";
import { validateSearch } from "../src/modules/TransportModule/server/handlers";
import type {
  PlaceOption,
  SearchState,
} from "../src/modules/TransportCoreModule/types";
const state: SearchState = {
  country: "CZ",
  arrive: false,
  direct: false,
  at: "2026-10-09T10:00:00Z",
};
test("exact municipality precedes its station and GPS and survives URL, submit and validation", () => {
  for (const [country, name, typed] of [
    ["CZ", "Tábor", "tabor"],
    ["SK", "Košice", "kosice"],
    ["AT", "Wien", "wien"],
    ["PL", "Łódź", "lodz"],
    ["DE", "Berlin", "berlin"],
  ]) {
    const city: PlaceOption = {
      id: "city",
      name,
      state: country,
      kind: "city",
      lat: 50,
      lon: 14,
      sourceMode: "index",
    };
    const station: PlaceOption = {
      ...city,
      id: "stop",
      kind: "stop",
      name: `${name} main station`,
      cityStation: true,
      matchedCity: name,
      stationPriority: 0,
    };
    assert.equal(chooseTypedPlace(typed, state, [station, city]), city);
    assert.equal(rankWorldPlaces([station, city], typed)[0], city);
    const selected = selectPlace(city)!;
    assert.equal(selected.type, "municipality");
    const input = { ...state, country, from: selected, to: selected };
    const restored = readState(writeState(input));
    assert.deepEqual(restored.from, selected);
    const body = searchBody(restored);
    assert.deepEqual(body["from-dest"], {
      type: "municipality",
      name,
      state: country,
    });
    assert.deepEqual(validateSearch(body), body);
    assert.equal(
      chooseTypedPlace(typed, { ...state, city: name }, [station, city]),
      station,
    );
    assert.equal(selectPlace(station)?.type, "stop");
    assert.equal(selectPlace({ ...city, kind: "street" })?.type, "coordinates");
  }
});
test("invalid municipality never turns into GPS or an arbitrary stop", () => {
  const body = {
    "from-dest": { type: "municipality", state: "CZ", name: "Brno" },
    "to-dest": { type: "stop", id: "stop" },
    "from-date": state.at,
    "max-transfers": 5,
    limit: 10,
  };
  for (const p of [
    { type: "municipality", name: "Brno" },
    { type: "municipality", state: "CZ", name: "" },
    { type: "municipality", state: "CZ", name: "Brno\n" },
  ])
    assert.throws(() => validateSearch({ ...body, "from-dest": p }));
});
