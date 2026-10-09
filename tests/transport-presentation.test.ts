import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TransportBadge from "../src/modules/TransportCoreModule/components/TransportBadge";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import {
  placeDetail,
  placeLocationDetail,
} from "../src/modules/TransportCoreModule/providers/transportPresentation";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";

test("place metadata projection accepts only public country, served modes and explicit scope", async () => {
  const core = createCoreClient(
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
              id: "stop_1",
              name: "Test stop",
              state: "CZ",
              city: "Brno",
              region: "Jihomoravský kraj",
              district: "okres Brno-město",
              modes: [
                "tram",
                "bus",
                "tram",
                "__proto__",
                "city",
                {},
                "unknown",
              ],
              transport_scope: "urban",
              color: "secret",
              private_token: "secret",
            },
            {
              id: "stop_2",
              name: "Old stop",
              state: "invalid",
              modes: "tram",
              transport_scope: ["urban"],
              region: { private_token: "secret" },
              district: ["invalid"],
            },
          ],
        },
      }),
  );
  const result = await createTransportProvider(core).places("Test", "CZ");
  assert.deepEqual(result.data[0].modes, ["tram", "bus"]);
  assert.equal(result.data[0].state, "CZ");
  assert.equal(result.data[0].transportScope, "urban");
  assert.equal(result.data[0].region, "Jihomoravský kraj");
  assert.equal(result.data[0].district, "okres Brno-město");
  assert.equal(result.data[1].modes, undefined);
  assert.equal(result.data[1].state, undefined);
  assert.equal(result.data[1].transportScope, undefined);
  assert.equal(result.data[1].region, undefined);
  assert.equal(result.data[1].district, undefined);
  assert.ok(!JSON.stringify(result).includes("secret"));
});

test("same-name places and cities share country, region and district descriptions in every language", async () => {
  for (const state of ["CZ", "SK", "AT", "PL", "DE"]) {
    const raw = {
      id: `city_${state}`,
      name: "Same name",
      state,
      region: "Region A",
      district: "District A",
      city: "Same name",
      source_mode: "index",
    };
    const provider = createTransportProvider(
      createCoreClient(
        {
          baseUrl: "https://core.test/api",
          apiKey: "secret",
          tenantHost: "tram.test",
        },
        async () => Response.json({ success: true, data: { data: [raw] } }),
      ),
    );
    const city = (await provider.cities(state)).data[0];
    const place = (await provider.places("same", state)).data[0];
    assert.equal(city.region, "Region A");
    assert.equal(city.district, "District A");
    for (const lang of ["cs", "en", "de"] as const) {
      const t = dictionary(lang);
      assert.match(placeDetail(place, t), /Region A · District A · Same name/);
      assert.match(placeLocationDetail(city, t), /Region A · District A/);
      assert.notEqual(
        placeDetail(place, t),
        placeDetail({ ...place, district: "District B" }, t),
      );
    }
  }
  assert.equal(
    placeLocationDetail(
      { state: "DE", region: "Berlin", district: "Berlin", city: "Berlin" },
      dictionary("cs"),
    ),
    "Německo · Berlin",
  );
});

test("Java stop metadata reaches the same Astro shape in autocomplete, search and details", async () => {
  const stop = {
    id: "station_1",
    name: "Hub",
    state: "CZ",
    city: "Brno",
    lat: 49.2,
    lon: 16.6,
    modes: ["bus", "tram", "trolleybus"],
    transport_scope: "mixed",
    source_mode: "otp",
  };
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://core.test/api",
        apiKey: "secret",
        tenantHost: "tram.test",
      },
      async (url) => {
        const path = new URL(String(url)).pathname;
        const data = path.endsWith("places/search")
          ? { data: [stop] }
          : path.includes("/stops/")
            ? { result: stop }
            : path.includes("/trips/")
              ? { result: { stops: [{ stop }] } }
              : {
                  journeys: [
                    {
                      legs: [
                        {
                          mode: "tram",
                          from: stop,
                          to: stop,
                          scheduled_departure: "2026-10-04T10:00:00Z",
                          scheduled_arrival: "2026-10-04T10:10:00Z",
                        },
                      ],
                    },
                  ],
                  resolved_places: { from: stop, to: stop },
                };
        return Response.json({ success: true, data });
      },
    ),
  );
  const places = await provider.places("Hub", "CZ");
  const search = await provider.search({});
  const detail = await provider.stop(stop.id);
  const trip = await provider.trip("trip_1");
  for (const place of [
    places.data[0],
    search.resolvedPlaces.from,
    search.resolvedPlaces.to,
    search.journeys[0].legs[0].from,
    search.journeys[0].legs[0].to,
    detail,
    trip.stops[0].stop,
  ]) {
    assert.ok(place);
    assert.deepEqual(place.modes, stop.modes);
    assert.equal(place.transportScope, "mixed");
    assert.equal(place.state, "CZ");
    assert.equal(place.city, "Brno");
  }
});

test("station descriptions localize country, city and supplied modes without inferring MHD", () => {
  const place = {
    id: "s1",
    name: "Hauptbahnhof",
    city: "Berlin",
    state: "DE",
    modes: ["train"],
    sourceMode: "otp",
    lat: null,
    lon: null,
  };
  for (const lang of ["cs", "en", "de"] as const) {
    const t = dictionary(lang);
    assert.equal(
      placeDetail(place, t),
      [t.station, t.germany, "Berlin", t.mode_train].join(" · "),
    );
    assert.ok(!placeDetail(place, t).includes(t.urbanTransport));
    const legacy = placeDetail(
      { ...place, modes: undefined, city: null, state: null },
      t,
    );
    assert.equal(legacy, t.stopName);
  }
});

test("shared symbols and service badges use the same palette and safe unknown-mode fallback", () => {
  const t = dictionary("cs");
  for (const mode of ["tram", "train", "bus", "trolleybus"]) {
    const symbol = renderToStaticMarkup(
      createElement(TransportBadge, { mode, t, variant: "icon" }),
    );
    const badge = renderToStaticMarkup(
      createElement(TransportBadge, { mode, t, line: "22" }),
    );
    assert.equal(
      symbol.match(/style="([^"]+)"/)?.[1],
      badge.match(/style="([^"]+)"/)?.[1],
    );
    assert.equal(
      symbol.match(/<path d="([^"]+)"/)?.[1],
      badge.match(/<path d="([^"]+)"/)?.[1],
    );
  }
  const unknown = renderToStaticMarkup(
    createElement(TransportBadge, { mode: "__proto__", t, line: "<script>" }),
  );
  assert.match(unknown, /data-mode="transport"/);
  assert.match(unknown, /&lt;script&gt;/);
  assert.ok(!unknown.includes("__proto__"));
});
