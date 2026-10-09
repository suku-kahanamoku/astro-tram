import { test, expect, type Locator } from "@playwright/test";

const stopId = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const selection = new URLSearchParams({
  fromKind: "stop",
  from: stopId("S1"),
  fromLabel: "Velmi dlouhý název výchozí zastávky hlavního města",
  toKind: "stop",
  to: stopId("S2"),
  toLabel: "Praha, Malostranská",
  at: "2026-10-06T08:00:00Z",
  country: "CZ",
});

async function sharedShell(dialog: Locator) {
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".ui-dialog-header")).toHaveCount(1);
  const close = dialog.locator("[data-dialog-close]");
  await expect(close).toHaveCount(1);
  await expect(close).toHaveAccessibleName("Zavřít");
  await expect(close).toBeFocused();
  await dialog.evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  const bounds = (await close.boundingBox())!;
  const header = (await dialog.locator(".ui-dialog-header").boundingBox())!;
  const heading = (await dialog.locator(".ui-dialog-heading").boundingBox())!;
  const titleId = await dialog.getAttribute("aria-labelledby");
  await expect(dialog.locator("h2")).toHaveAttribute("id", titleId!);
  expect(bounds.width).toBe(44);
  expect(bounds.height).toBe(44);
  expect(Math.abs(bounds.y - header.y)).toBeLessThan(1);
  expect(
    Math.abs(bounds.x + bounds.width - header.x - header.width),
  ).toBeLessThan(1);
  expect(heading.x + heading.width).toBeLessThan(bounds.x);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const content = dialog.locator(".ui-dialog-content");
  const scroller = (await content.count()) ? content : dialog;
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  if (await content.count()) {
    expect(await dialog.evaluate((element) => element.scrollTop)).toBe(0);
    const frame = (await dialog.boundingBox())!;
    expect(
      Math.abs(bounds.x + bounds.width - frame.x - frame.width + 1),
    ).toBeLessThan(1);
    const area = (await content.boundingBox())!;
    expect(area.y).toBeGreaterThanOrEqual(header.y + header.height);
  }
  const scrolled = (await close.boundingBox())!;
  expect(Math.abs(scrolled.y - bounds.y)).toBeLessThan(1);
  await expect(close).toBeInViewport();
}

for (const width of [320, 1280]) {
  test(`all map modes and nested trip dialogs share an edge close button (${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 500 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/transport/search/**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const journey = payload.data.journeys[0];
      const transit = journey.legs[0];
      journey.legs = [
        {
          ...transit,
          mode: "walk",
          tripId: null,
          line: "",
          geometry: null,
        },
        transit,
      ];
      payload.data.journeys = [journey];
      await route.fulfill({ json: payload });
    });
    await page.route("**/api/transport/trip/**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const stops = payload.data.stops;
      payload.data.stops = Array.from({ length: 30 }, (_, index) => ({
        ...stops[index % stops.length],
        stop: {
          ...stops[index % stops.length].stop,
          name: "Velmi dlouhý název zastávky na opačném konci města",
        },
      }));
      await route.fulfill({ json: payload });
    });
    // Coordinate selection from either field uses the same editable map shell.
    await page.goto(
      "/?fromKind=coordinates&fromLat=50.07&fromLon=14.42&fromLabel=Bod" +
        "&toKind=coordinates&toLat=50.08&toLon=14.43&toLabel=Cíl",
    );
    const map = page.locator("[data-map-dialog]");
    for (const side of ["from", "to"]) {
      const opener = page.locator(`[data-map="${side}"]`);
      await expect(opener).toBeEnabled();
      await opener.click();
      await expect(map.locator("canvas").first()).toBeVisible();
      await expect(map.locator("[data-map-form]")).toBeVisible();
      await sharedShell(map);
      await map.locator("[data-dialog-close]").click();
      await expect(map).not.toBeVisible();
      await expect(opener).toBeFocused();
    }
    await page.goto("/spojeni/?" + selection);
    await expect(page.locator(".journey-card")).toHaveCount(1);
    const snapshot = page.url();
    // Selected stop, walking segment and entire journey all use the wrapper.
    const stopMap = page.locator('[data-map="from"]');
    await stopMap.click();
    await expect(map.locator("canvas").first()).toBeVisible();
    await sharedShell(map);
    await page.keyboard.press("Escape");
    await expect(stopMap).toBeFocused();
    const walk = page.locator('.summary-badges [data-walk-map="0"]');
    await walk.click();
    await expect(map.locator("[data-walk-endpoints]")).toBeVisible();
    await sharedShell(map);
    await map.locator("[data-dialog-close]").click();
    await expect(walk).toBeFocused();
    const toggle = page.locator(".journey-summary-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    const routeMap = page.getByRole("link", { name: "Trasa na mapě" });
    await routeMap.click();
    await expect(map.locator("canvas").first()).toBeVisible();
    await sharedShell(map);
    await page.keyboard.press("Escape");
    await expect(routeMap).toBeFocused();
    const service = page.locator(".summary-badges [data-summary-trip]");
    await service.click();
    const trip = page.locator("[data-trip-dialog]");
    await expect(trip.locator(".trip-call")).toHaveCount(30);
    await sharedShell(trip);
    await trip.locator(".ui-dialog-content").evaluate((element) => {
      element.scrollTop = 0;
    });
    const nestedStop = trip.locator('[data-trip-stop-map="1"]');
    await nestedStop.click();
    await expect(map.locator("canvas").first()).toBeVisible();
    await sharedShell(map);
    await page.screenshot({ path: testInfo.outputPath("nested-map.png") });
    await map.locator("[data-dialog-close]").click();
    await expect(map).not.toBeVisible();
    await expect(trip).toBeVisible();
    await expect(nestedStop).toBeFocused();
    await trip.locator("[data-dialog-close]").click();
    await expect(trip).not.toBeVisible();
    await expect(service).toBeFocused();
    expect(page.url()).toBe(snapshot);
    expect(errors).toEqual([]);
  });
}
