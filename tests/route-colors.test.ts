import test from "node:test";
import assert from "node:assert/strict";
import {
  projectTransportPalette,
  modePalette,
  createTransportPaletteStore,
} from "../src/modules/TransportCoreModule/providers/transportPalette";
import { transportStyle } from "../src/modules/TransportCoreModule/providers/transportPresentation";
import { routeStyle } from "../src/modules/OSMModule/providers/routeStyle";
import CircleStyle from "ol/style/Circle.js";
import { createJavaTramClient } from "../src/modules/CoreModule/server/java-tram";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";

const raw = {
  transport: { background: "#eeeeee", foreground: "#111111" },
  bus: { background: "#fefefe", foreground: "#123456" },
  train: { background: "#ededed", foreground: "#456789" },
  walk: { background: "#cccccc", foreground: "#345678" },
};

test("Java palette reaches badge CSS and OpenLayers strokes unchanged for each leg", async () => {
  const provider = createTransportProvider(
    createJavaTramClient(
      {
        baseUrl: "https://java.test",
        serviceToken: "synthetic-presentation-test-token",
      },
      async (url) => {
        assert.equal(
          String(url),
          "https://java.test/transport/v1/presentation",
        );
        return Response.json({ success: true, data: raw });
      },
    ),
  );
  const palette = await provider.presentation();
  for (const mode of ["bus", "train", "walk", "unknown", "__proto__"]) {
    const color = modePalette(palette, mode)!;
    const badge = transportStyle(mode, palette) as Record<string, string>;
    const style = routeStyle(color.foreground, mode === "walk");
    assert.equal(style.getStroke()!.getColor(), badge["--mode-fg"]);
    const marker = style.getImage();
    assert.ok(marker instanceof CircleStyle);
    assert.equal(marker.getFill()!.getColor(), badge["--mode-fg"]);
    assert.deepEqual(
      style.getStroke()!.getLineDash(),
      mode === "walk" ? [1, 9] : null,
    );
  }
});

test("palette rejects unsafe CSS instead of forwarding it into map or badge", () => {
  assert.throws(() =>
    projectTransportPalette({
      ...raw,
      bus: { background: "url(secret)", foreground: "red" },
    }),
  );
  assert.throws(() => projectTransportPalette({ bus: raw.bus }));
  assert.equal(routeStyle("url(secret)").getStroke()!.getColor(), "#62686f");
});

test("many badges and map consumers load the palette once and receive the same snapshot", async () => {
  let requests = 0,
    notifications = 0;
  const store = createTransportPaletteStore(async () => {
    requests++;
    return raw;
  });
  const unsubscribe = store.subscribe(() => notifications++);
  await Promise.all(Array.from({ length: 50 }, () => store.ensure()));
  await store.ensure();
  assert.equal(requests, 1);
  assert.equal(notifications, 1);
  assert.deepEqual(store.getSnapshot().bus, raw.bus);
  unsubscribe();
});
