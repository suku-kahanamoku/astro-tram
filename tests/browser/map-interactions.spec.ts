import { test, expect, type Locator, type Page } from "@playwright/test";

/** Locate the rendered vector marker; tiles are blocked so this measures actual map movement. */
async function marker(canvas: Locator) {
  return canvas.evaluate((target) => {
    for (const image of target.querySelectorAll("canvas")) {
      const context = image.getContext("2d");
      if (!context || !image.width || !image.height) continue;
      const { data } = context.getImageData(0, 0, image.width, image.height);
      let x = 0,
        y = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4)
        if (
          data[i] > 180 &&
          data[i + 1] < 115 &&
          data[i + 2] < 110 &&
          data[i + 3] > 180
        ) {
          const pixel = i / 4;
          x += pixel % image.width;
          y += Math.floor(pixel / image.width);
          count++;
        }
      if (count) return { x: x / count, y: y / count };
    }
    return null;
  });
}

async function unfocusedMap(page: Page, opener: Locator) {
  await opener.click();
  const dialog = page.locator("[data-map-dialog]");
  const canvas = dialog.locator("[data-map-canvas]");
  await expect(canvas.locator("canvas").first()).toBeVisible();
  // Map gestures must work while focus remains on another control in the dialog.
  await expect(dialog.locator("[data-close-map]")).toBeFocused();
  await expect.poll(() => marker(canvas)).not.toBeNull();
  return { dialog, canvas };
}

for (const width of [375, 1280])
  for (const mode of ["picker", "stop"] as const)
    test(`first wheel and drag work in an unfocused ${mode} map (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/*tile.openstreetmap.org/**", (route) =>
        route.abort(),
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const query =
        mode === "picker"
          ? "fromKind=coordinates&fromLat=50.07&fromLon=14.42&fromLabel=Bod"
          : new URLSearchParams({
              fromKind: "stop",
              from: Buffer.from(
                JSON.stringify(["tram", "pid", "stop", "S1", null]),
              ).toString("base64url"),
              fromLabel: "Praha, Muzeum",
            });
      await page.goto("/?" + query);
      await expect(
        page.locator("[data-search-form] fieldset").first(),
      ).toBeEnabled();
      const opener = page.locator('[data-map="from"]');
      let { dialog, canvas } = await unfocusedMap(page, opener);
      const beforeWheel = (await marker(canvas))!;
      const bounds = (await canvas.boundingBox())!;
      await page.mouse.move(
        bounds.x + bounds.width * 0.75,
        bounds.y + bounds.height * 0.4,
      );
      await page.mouse.wheel(0, -120);
      await expect
        .poll(async () => {
          const point = await marker(canvas);
          return point
            ? Math.hypot(point.x - beforeWheel.x, point.y - beforeWheel.y)
            : 0;
        })
        .toBeGreaterThan(10);
      await dialog.locator("[data-close-map]").click();
      await expect(dialog).not.toBeVisible();

      ({ dialog, canvas } = await unfocusedMap(page, opener));
      const beforeDrag = (await marker(canvas))!;
      const area = (await canvas.boundingBox())!;
      const x = area.x + area.width * 0.4,
        y = area.y + area.height * 0.4;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 60, y + 30, { steps: 12 });
      await page.mouse.up();
      await expect
        .poll(async () => {
          const point = await marker(canvas);
          return point ? point.x - beforeDrag.x : 0;
        })
        .toBeGreaterThan(30);
      await expect(dialog).toBeVisible();
      expect(errors).toEqual([]);
    });
