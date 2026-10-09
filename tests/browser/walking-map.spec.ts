import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    walkingMapStrokes: { dash: number[]; segments: number }[];
    walkingMapLabels: string[];
  }
}

const stopId = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const path =
  "/spojeni/?" +
  new URLSearchParams({
    fromKind: "stop",
    from: stopId("S1"),
    fromLabel: "Brno, Preslova",
    toKind: "stop",
    to: stopId("S2"),
    toLabel: "Stařeč, Tyršova",
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
  });

async function walkingResult(page: Page, geometry = true) {
  let searches = 0;
  await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/api/transport/search/**", async (route) => {
    searches++;
    const response = await route.fetch();
    const payload = await response.json();
    const journey = payload.data.journeys[0];
    const transit = journey.legs[0];
    const from = {
      ...transit.from,
      name: "Brno, Preslova",
      lat: 49.192,
      lon: 16.57,
    };
    const to = {
      ...transit.to,
      name: "Brno, Pisárky",
      lat: 49.188,
      lon: 16.575,
    };
    const walk = {
      ...transit,
      mode: "walk",
      tripId: null,
      line: "",
      realtime: false,
      expectedDeparture: null,
      expectedArrival: null,
      from,
      to,
      geometry: geometry
        ? {
            type: "LineString",
            coordinates: [
              [16.57, 49.192],
              [16.572, 49.191],
              [16.575, 49.188],
            ],
          }
        : null,
    };
    journey.legs = [
      walk,
      transit,
      {
        ...walk,
        from: { ...from, name: "Stařeč, nádraží" },
        to: { ...to, name: "Stařeč, Tyršova" },
      },
    ];
    payload.data.journeys = [journey];
    await route.fulfill({ json: payload });
  });
  await page.addInitScript(() => {
    window.walkingMapStrokes = [];
    window.walkingMapLabels = [];
    const segments = new WeakMap<CanvasRenderingContext2D, number>();
    const prototype = CanvasRenderingContext2D.prototype;
    const begin = prototype.beginPath,
      line = prototype.lineTo,
      stroke = prototype.stroke,
      fillText = prototype.fillText;
    prototype.beginPath = function () {
      segments.set(this, 0);
      return begin.call(this);
    };
    prototype.lineTo = function (x, y) {
      segments.set(this, (segments.get(this) ?? 0) + 1);
      return line.call(this, x, y);
    };
    prototype.stroke = function (...args: [path?: Path2D]) {
      const dash = this.getLineDash();
      if (dash.some((value) => value > 0))
        window.walkingMapStrokes.push({
          dash,
          segments: segments.get(this) ?? 0,
        });
      return Reflect.apply(stroke, this, args);
    };
    prototype.fillText = function (text, ...args) {
      window.walkingMapLabels.push(text);
      return Reflect.apply(fillText, this, [text, ...args]);
    };
  });
  return () => searches;
}

for (const width of [390, 1280]) {
  test(`walking badges open only their segment with a dotted path and localized endpoint labels (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const searches = await walkingResult(page);
    let tripRequests = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/transport/trip/")) tripRequests++;
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    const card = page.locator(".journey-card").first();
    const summary = card.locator('.journey-summary [data-walk-map="0"]');
    await summary.click();
    const dialog = page.locator("[data-map-dialog]");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("h2")).toHaveText("Pěší trasa na mapě");
    await expect(dialog.locator("[data-walk-endpoints]")).toHaveText(
      "Odkud: Brno, Preslova → Kam: Brno, Pisárky",
    );
    await expect(dialog.locator("canvas").first()).toBeVisible();
    await expect(dialog.locator("[data-map-form]")).toHaveCount(0);
    await expect(dialog.locator("[data-map-error]")).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.walkingMapStrokes.some((stroke) => stroke.segments >= 2),
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() =>
          ["Odkud", "Kam"].every((label) =>
            window.walkingMapLabels.includes(label),
          ),
        ),
      )
      .toBe(true);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/walking-route-${width}.png` });
    await dialog.locator("[data-close-map]").click();
    await expect(dialog).not.toBeVisible();
    await expect(summary).toBeFocused();
    const detail = card.locator('.journey-detail [data-walk-map="2"]');
    await detail.click();
    await expect(dialog.locator("[data-walk-endpoints]")).toHaveText(
      "Odkud: Stařeč, nádraží → Kam: Stařeč, Tyršova",
    );
    await expect(dialog.locator("canvas").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(detail).toBeFocused();
    expect(searches()).toBe(1);
    expect(tripRequests).toBe(0);
    expect(errors).toEqual([]);
    await expect(page).not.toHaveURL(/map=|stopLeg=/);
  });
}

test("a walking segment without geometry shows endpoints and no invented path", async ({
  page,
}) => {
  await walkingResult(page, false);
  await page.goto(path);
  await page.locator('.journey-summary [data-walk-map="0"]').click();
  const dialog = page.locator("[data-map-dialog]");
  await expect(dialog.locator("canvas").first()).toBeVisible();
  await expect(dialog.locator("[data-map-error]")).toContainText(
    "Pěší trasa není dostupná",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        ["Odkud", "Kam"].every((label) =>
          window.walkingMapLabels.includes(label),
        ),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.walkingMapStrokes)).toEqual([]);
});
