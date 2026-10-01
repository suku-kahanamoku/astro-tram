import { test, expect, type Page } from "@playwright/test";
const id = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const path =
  "/spojeni/?" +
  new URLSearchParams({
    fromKind: "stop",
    from: id("S1"),
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: id("S2"),
    toLabel: "Praha, Malostranská",
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
  });
const backdrop = (page: Page) => page.mouse.click(3, 3);
const blockTiles = async (page: Page) => {
  await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
};

test("expanded accordion badges open the trip; backdrop closes only the top dialog and restores focus", async ({
  page,
}) => {
  await blockTiles(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  await page.locator(".journey-summary").first().click();
  const badge = page.locator('[data-summary-trip="0"]').first();
  await badge.click();
  const trip = page.locator("[data-trip-dialog]");
  await expect(trip).toBeVisible();
  await expect(trip.locator(".trip-call")).toHaveCount(3);
  await expect(page).toHaveURL(/leg=0/);
  const stop = trip.locator('[data-trip-stop-map="1"]');
  await stop.click();
  const map = page.locator("[data-map-dialog]");
  await expect(map.locator("canvas").first()).toBeVisible();
  await backdrop(page);
  await expect(map).not.toBeVisible();
  await expect(trip).toBeVisible();
  await expect(stop).toBeFocused();
  // Dragging from the content onto the backdrop is not a backdrop click.
  const title = await trip.locator("h2").boundingBox();
  await page.mouse.move(title!.x + 5, title!.y + 5);
  await page.mouse.down();
  await page.mouse.move(3, 3);
  await page.mouse.up();
  await expect(trip).toHaveAttribute("open", "");
  await backdrop(page);
  await expect(trip).not.toBeVisible();
  await expect(page).not.toHaveURL(/leg=/);
  await expect(badge).toBeFocused();
  expect(errors).toEqual([]);
});

test("refocusing a populated place field opens its choices without clearing the selection", async ({
  page,
}) => {
  await page.goto(path);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  const input = page.locator("#place-from");
  await expect(input).toBeEnabled();
  await input.focus();
  await expect(page.locator("#suggestions-from")).toBeVisible();
  await expect(input).toHaveValue("Praha, Muzeum");
  expect(
    await input.evaluate((el) => ({
      start: (el as HTMLInputElement).selectionStart,
      end: (el as HTMLInputElement).selectionEnd,
    })),
  ).toEqual({ start: 0, end: 13 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#suggestions-from")).toBeHidden();
  await page.locator("#travel-city").focus();
  await expect(page.locator("#city-options")).toBeVisible();
});

test("opening the same trip preserves loaded intermediate stops and accordion height", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/transport/trip/**", async (route) => {
    requests++;
    const response = await route.fetch();
    const payload = await response.json();
    const stops = payload.data.stops;
    payload.data.stops = [stops[0], stops[2], stops[1]].map((call) => ({
      ...call,
      arrival: null,
      departure: null,
    }));
    await route.fulfill({ json: payload });
  });
  await page.goto(path);
  await page.locator(".journey-summary").first().click();
  const card = page.locator(".journey-card.is-open");
  await card.locator(".intermediate-toggle").click();
  const list = card.locator("[data-intermediate-stops]");
  await expect(list.locator(".trip-call")).toHaveCount(1);
  // Finish actual disclosure animations, not a guessed sleep.
  await card.evaluate(async (el) => {
    await Promise.allSettled(
      el.getAnimations({ subtree: true }).map((a) => a.finished),
    );
  });
  const before = await card.boundingBox();
  await card.locator('[data-trip-open="0"]').click();
  await expect(page.locator("[data-trip-dialog] .trip-call")).toHaveCount(3);
  await expect(list.locator(".trip-call")).toHaveCount(1);
  const after = await card.boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(2);
  expect(requests).toBe(1);
  await page.keyboard.press("Escape");
  await expect(list.locator(".trip-call")).toHaveCount(1);
});

test("slow trip responses keep dialog geometry stable and long headings clear of the close button", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/transport/trip/**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.stops[0].stop.name =
      "Velmi dlouhý název výchozí zastávky hlavního města";
    payload.data.stops.at(-1).stop.name =
      "Dlouhý název cílové zastávky na opačném konci města";
    await ready;
    await route.fulfill({ json: payload });
  });
  await page.goto(path);
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-summary-trip="0"]').first().click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog.locator(".trip-loading")).toBeVisible();
  await dialog.evaluate(async (el) => {
    await Promise.allSettled(el.getAnimations().map((a) => a.finished));
  });
  const before = await dialog.boundingBox();
  release();
  await expect(dialog.locator(".trip-call")).toHaveCount(3);
  const after = await dialog.boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
  const title = await dialog.locator("h2").boundingBox();
  const close = await dialog.locator("[data-close-trip]").boundingBox();
  expect(title!.x + title!.width).toBeLessThan(close!.x);
  await expect(dialog.locator("[data-trip-legend]")).not.toContainText(
    "Poznámka",
  );
  await expect(dialog.locator("[data-trip-notes]")).toContainText("Poznámka");
  await page.screenshot({ path: testInfo.outputPath("trip-mobile.png") });
});

test("every supported mode has its own badge color; reduced motion disables transitions", async ({
  page,
}) => {
  const modes = [
    "walk",
    "bus",
    "coach",
    "trolleybus",
    "tram",
    "train",
    "metro",
    "ferry",
    "airplane",
    "gondola",
    "cable_car",
    "funicular",
    "monorail",
    "transport",
  ];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/transport/search/**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const journey = payload.data.journeys[0];
    journey.legs = modes.map((mode) => ({ ...journey.legs[0], mode }));
    payload.data.journeys = [journey];
    await route.fulfill({ json: payload });
  });
  await page.goto(path);
  await page.locator(".journey-summary").first().click();
  const badges = page.locator(".summary-badges .route-badge");
  await expect(badges).toHaveCount(modes.length);
  const colors = await badges.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).backgroundColor),
  );
  expect(new Set(colors).size).toBe(modes.length);
  await badges.first().click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("transition-duration", "0s");
  expect(await page.locator("body").innerText()).not.toContain("↗");
  for (const link of await dialog.locator('a[href^="http"]').all())
    await expect(link).toHaveAttribute("target", "_blank");
  await backdrop(page);
  await expect(dialog).not.toBeVisible();
});

test("map loading reserves space and keeps its canvas throughout the exit transition", async ({
  page,
}) => {
  await blockTiles(page);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/transport/stop/**", async (route) => {
    const response = await route.fetch();
    await ready;
    await route.fulfill({ response });
  });
  await page.goto(path);
  await expect(page.locator("#place-from")).toBeEnabled();
  await page.locator('[data-map="from"]').click();
  const dialog = page.locator("[data-map-dialog]");
  await expect(dialog.locator("[data-map-error]")).toContainText(
    "Načítám polohu zastávky",
  );
  await dialog.evaluate(async (el) => {
    await Promise.allSettled(el.getAnimations().map((a) => a.finished));
  });
  const before = await dialog.boundingBox();
  release();
  await expect(dialog.locator("canvas").first()).toBeVisible();
  const after = await dialog.boundingBox();
  expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
  // Make the exit observable even on a busy test worker.
  await page.addStyleTag({ content: "dialog { transition-duration: 1s; }" });
  await dialog.locator("[data-close-map]").click();
  expect(await dialog.locator("canvas").count()).toBeGreaterThan(0);
  await expect(dialog).not.toBeVisible();
  await expect(dialog.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-map="from"]')).toBeFocused();
});

test("new results scroll into view once; date and service badges expand with the accordion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = Element.prototype.scrollIntoView;
    (window as any).resultScrolls = 0;
    Element.prototype.scrollIntoView = function (options) {
      if (this.classList.contains("results-heading"))
        (window as any).resultScrolls++;
      original.call(this, options);
    };
  });
  await page.goto(path);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect
    .poll(() => page.evaluate(() => (window as any).resultScrolls))
    .toBe(1);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const heading = await page.locator(".results-heading").boundingBox();
  const header = await page.locator(".tram-header").boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(
    Math.max(0, header!.y + header!.height),
  );
  await expect(page.locator(".journey-summary-footer")).toHaveCount(0);
  const card = page.locator(".journey-card").first();
  await card.locator(".journey-summary").click();
  await expect(card.locator(".journey-summary-footer")).toBeVisible();
  await card.locator("[data-summary-trip]").first().click();
  await expect(page.locator("[data-trip-dialog]")).toBeVisible();
  await page.keyboard.press("Escape");
  await card.locator(".journey-summary").click();
  await expect(card.locator(".journey-summary-footer")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).resultScrolls)).toBe(1);
  const previousAt = new URL(page.url()).searchParams.get("at");
  await page.locator("#travel-time").fill("11:00");
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  await page.waitForURL((url) => url.searchParams.get("at") !== previousAt);
  await expect
    .poll(() => page.evaluate(() => (window as any).resultScrolls))
    .toBe(1);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
