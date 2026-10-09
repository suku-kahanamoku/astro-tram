import { test, expect, type Locator } from "@playwright/test";

async function markerPixels(canvas: Locator) {
  return canvas.locator("canvas").evaluateAll((canvases) => {
    let count = 0,
      x = 0;
    for (const element of canvases) {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas
        .getContext("2d")
        ?.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!pixels) continue;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] === 0 &&
          pixels[i + 1] === 153 &&
          pixels[i + 2] === 85 &&
          pixels[i + 3] > 240
        ) {
          count++;
          x += (i / 4) % canvas.width;
        }
    }
    return { count, x: count ? x / count : 0 };
  });
}

for (const width of [375, 1280])
  test(`OSM component updates layers without replacing the map and disposes on unmount (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(async () => {
      const path = "/tests/osm-harness.tsx";
      const harness = await import(/* @vite-ignore */ path);
      (window as any).unmountOSMHarness = harness.mountOSMHarness();
    });
    const harness = page.locator("#osm-test-harness");
    const canvas = harness.getByRole("region", { name: "Interaktivní mapa" });
    await expect(harness.locator("[data-osm-map]")).toHaveAttribute(
      "data-state",
      "ready",
    );
    await expect
      .poll(async () => (await markerPixels(canvas)).count)
      .toBeGreaterThan(10);
    await expect(canvas.locator(".ol-attribution")).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "OpenStreetMap" }),
    ).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    await canvas.evaluate((element) => {
      (window as any).osmViewport = element.querySelector(".ol-viewport");
    });
    const box = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(harness.locator("[data-marker-selection]")).toHaveText(
      "point",
    );
    await expect(harness.locator("[data-picked-point]")).toBeEmpty();
    const before = await markerPixels(canvas);
    await harness.getByRole("button", { name: "Move marker" }).click();
    await expect
      .poll(async () => (await markerPixels(canvas)).x - before.x)
      .toBeGreaterThan(15);
    expect(
      await canvas.evaluate(
        (element) =>
          element.querySelector(".ol-viewport") === (window as any).osmViewport,
      ),
    ).toBe(true);
    await harness.getByRole("button", { name: "Hide markers" }).click();
    await expect.poll(async () => (await markerPixels(canvas)).count).toBe(0);
    await harness.getByRole("button", { name: "Show markers" }).click();
    await expect
      .poll(async () => (await markerPixels(canvas)).count)
      .toBeGreaterThan(10);
    await canvas.click({
      position: { x: box.width * 0.25, y: box.height * 0.7 },
    });
    await expect(harness.locator("[data-picked-point]")).not.toBeEmpty();
    await canvas
      .getByRole("button", { name: "Přiblížit", exact: true })
      .click();
    await expect
      .poll(async () =>
        Number(await harness.locator("[data-map-zoom]").textContent()),
      )
      .toBeGreaterThan(13.5);
    await harness.getByRole("button", { name: "Add route" }).click();
    await harness.getByRole("button", { name: "Zobrazit vše" }).click();
    expect(
      await canvas.evaluate(
        (element) => element.querySelectorAll(".ol-viewport").length,
      ),
    ).toBe(1);
    await page.screenshot({ path: `test-results/osm-module-${width}.png` });
    await harness.getByRole("button", { name: "Toggle map" }).click();
    await expect(canvas.locator(".ol-viewport")).toHaveCount(0);
    await harness.getByRole("button", { name: "Toggle map" }).click();
    await expect(canvas.locator(".ol-viewport")).toHaveCount(1);
    await page.evaluate(() => (window as any).unmountOSMHarness());
    await expect(harness).toHaveCount(0);
    expect(errors).toEqual([]);
  });
