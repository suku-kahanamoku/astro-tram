import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TransportBadge from "../src/modules/TransportCoreModule/components/TransportBadge";
import { transportModes } from "../src/modules/TransportCoreModule/config/transportModes";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import { placeDetail } from "../src/modules/TransportCoreModule/providers/transportPresentation";
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
            },
          ],
        },
      }),
  );
  const result = await createTransportProvider(core).places("Test", "CZ");
  assert.deepEqual(result.data[0].modes, ["tram", "bus"]);
  assert.equal(result.data[0].state, "CZ");
  assert.equal(result.data[0].transportScope, "urban");
  assert.equal(result.data[1].modes, undefined);
  assert.equal(result.data[1].state, undefined);
  assert.equal(result.data[1].transportScope, undefined);
  assert.ok(!JSON.stringify(result).includes("secret"));
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

test("all transport label palettes keep readable foreground contrast", () => {
  const luminance = (hex: string) => {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  for (const [mode, palette] of Object.entries(transportModes)) {
    assert.ok(
      (luminance(palette.background) + 0.05) /
        (luminance(palette.foreground) + 0.05) >=
        4.5,
      mode,
    );
  }
});
