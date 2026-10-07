import test from "node:test";
import assert from "node:assert/strict";
import {
  scopedPlaces,
  rankWorldPlaces,
} from "../src/modules/TransportSearchModule/providers/placeScope";
import { journeySubmission } from "../src/modules/TransportSearchModule/providers/journeySubmission";
import { transportClient } from "../src/modules/TransportCoreModule/providers/client";
import {
  readState,
  writeState,
  searchBody,
} from "../src/modules/TransportCoreModule/providers/state";
import { selectPlace } from "../src/modules/TransportCoreModule/providers/placeSelection";
import type {
  PlaceOption,
  SearchState,
} from "../src/modules/TransportCoreModule/types";

const world: SearchState = {
  country: "",
  arrive: false,
  direct: false,
  at: "2026-10-07T10:00:00Z",
};
const fix = { lat: 49.2, lon: 16.6, observedAt: "2026-10-07T10:00:00Z" };
const option = (
  id: string,
  state: string,
  kind: "stop" | "street" = "stop",
): PlaceOption => ({
  id,
  state,
  kind,
  name: "Grohova",
  lat: 49.201,
  lon: 16.61,
  sourceMode: "index",
});

test("World URL preserves endpoint countries without a city filter or changing legacy URLs", () => {
  const state = {
    ...world,
    from: selectPlace(option("from", "DE")),
    to: selectPlace(option("to", "DE")),
  };
  const params = writeState({ ...state, city: "Brno" });
  assert.equal(params.get("scope"), "world");
  assert.equal(params.has("city"), false);
  assert.equal(params.has("country"), false);
  assert.deepEqual(readState(params), state);
  assert.equal(searchBody(state).state, "DE");
  assert.equal(readState(new URLSearchParams()).country, "CZ");
  assert.equal(
    readState(new URLSearchParams("scope=world&city=Brno&country=CZ")).city,
    undefined,
  );
});

test("country and city stay strict even with GPS and a legacy automatic area mode", async () => {
  const old = transportClient.places;
  const queries: Record<string, unknown>[] = [];
  transportClient.places = async (q) => {
    queries.push(q);
    return [option("good", "SK"), option("wrong", "CZ")];
  };
  try {
    const result = await scopedPlaces(
      "Grohova",
      { ...world, country: "SK", city: "Bratislava", areaMode: "gps" },
      ["CZ", "SK"],
      new AbortController().signal,
      fix,
    );
    assert.deepEqual(queries, [
      {
        name: { $regex: "Grohova" },
        state: "SK",
        city: "Bratislava",
        latitude: fix.lat,
        longitude: fix.lon,
        observed_at: fix.observedAt,
      },
    ]);
    assert.deepEqual(
      result.map((p) => p.id),
      ["good"],
    );
  } finally {
    transportClient.places = old;
  }
});

test("World uses advertised countries only and retains healthy results if one country fails", async () => {
  const old = transportClient.places;
  const queries: Record<string, unknown>[] = [];
  transportClient.places = async (q) => {
    queries.push(q);
    if (q.state === "SK") throw new Error("unavailable");
    return [
      option(
        String(q.state),
        String(q.state),
        q.state === "DE" ? "street" : "stop",
      ),
    ];
  };
  try {
    const result = await scopedPlaces(
      "Grohova",
      { ...world, city: "ignored" },
      ["CZ", "DE", "SK", "DE"],
      new AbortController().signal,
    );
    assert.deepEqual(
      queries.map((q) => q.state),
      ["CZ", "DE", "SK"],
    );
    assert.ok(queries.every((q) => q.city === undefined));
    assert.deepEqual(
      result.map((p) => p.id),
      ["CZ", "DE"],
    );
    await assert.rejects(
      scopedPlaces("Grohova", world, ["SK"], new AbortController().signal),
      /unavailable/,
    );
  } finally {
    transportClient.places = old;
  }
});

test("World ranks exact stop names before partial transit matches and streets, then nearest GPS", () => {
  const near = option("near", "CZ"),
    far = { ...option("far", "DE"), lat: 52, lon: 13 };
  const partial = { ...near, id: "partial", name: "Grohova zastávka" };
  const street = option("street", "CZ", "street");
  assert.deepEqual(
    rankWorldPlaces([street, far, partial, near, near], "grohova", fix).map(
      (p) => p.id,
    ),
    ["near", "far", "partial", "street"],
  );
});

test("World resolves the current origin country independently of the destination country", async () => {
  const old = transportClient.places;
  transportClient.places = async (q) => {
    assert.equal(q.state, undefined);
    return [option("nearby", "SK")];
  };
  try {
    const fresh = {
      ...fix,
      observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
    const state: SearchState = {
      ...world,
      from: { type: "current_location", label: "" },
      to: selectPlace(option("to", "DE")),
    };
    assert.equal(
      (await journeySubmission(state, new AbortController().signal, fresh))
        .state,
      "SK",
    );
    assert.equal(state.country, "");
  } finally {
    transportClient.places = old;
  }
});
