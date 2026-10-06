import { test, expect } from "@playwright/test";

const stopId = (id: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", id, null])).toString(
    "base64url",
  );
const path =
  "/spojeni/?" +
  new URLSearchParams({
    fromKind: "stop",
    from: stopId("S1"),
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: stopId("S2"),
    toLabel: "Praha, Malostranská",
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
    city: "Praha",
  });

for (const width of [375, 1280]) {
  test(`accordion openings refresh delay without GPS or WebSocket at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let reads = 0,
      delay = 360;
    await page.route("**/api/transport/search/**", async (route) => {
      const json = await (await route.fetch()).json();
      // Two distinct journey cards share the same service; both openings must refresh it.
      json.data.journeys[1].legs = [{ ...json.data.journeys[0].legs[0] }];
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/tracking/", (route) =>
      route.fulfill({
        json: { success: true, data: { status: "disabled" } },
      }),
    );
    await page.route("**/api/transport/observation/**", (route) => {
      reads++;
      const now = Date.now();
      return route.fulfill({
        json: {
          success: true,
          data: {
            status: "live",
            position: null,
            delay_seconds: delay,
            cancelled: false,
            observed_at: new Date(now).toISOString(),
            valid_until: new Date(now + 30000).toISOString(),
          },
        },
      });
    });
    await page.goto(path);
    const cards = page.locator(".journey-card");
    await expect(cards).toHaveCount(2);
    expect(reads).toBe(0);
    await cards.first().locator(".journey-summary-toggle").click();
    await expect(cards.first().locator(".leg .delay-badge")).toHaveText(
      "Zpoždění 6 min",
    );
    expect(reads).toBe(1);
    await expect(cards.first().locator("[data-position-status]")).toHaveText(
      "Aktuální poloha není dostupná.",
    );
    await expect(page.locator("[data-trip-vehicle-dot]")).toHaveCount(0);
    await cards.last().locator(".journey-summary-toggle").click();
    await expect.poll(() => reads).toBe(2);
    await cards.first().locator(".journey-summary-toggle").click();
    await cards.first().locator(".journey-summary-toggle").click();
    await expect.poll(() => reads).toBe(3);
    await cards.first().locator("[data-summary-trip]").click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect.poll(() => reads).toBe(4);
    await expect(dialog.locator(".delay-badge")).toHaveText("Zpoždění 6 min");
    await expect(dialog.locator("[data-trip-vehicle-dot]")).toHaveCount(0);
    delay = 0;
    await page.keyboard.press("Escape");
    await cards.first().locator("[data-summary-trip]").click();
    await expect.poll(() => reads).toBe(5);
    await expect(dialog.locator("[data-delay-status]")).toHaveText(
      "Bez zpoždění",
    );
    await expect(cards.first().locator(".leg [data-delay-status]")).toHaveText(
      "Bez zpoždění",
    );
    await expect(dialog.locator(".delay-badge")).toHaveCount(0);
  });
}

test("HTTP GPS at the origin is drawn in accordion and dialog before departure, with no socket", async ({
  page,
}) => {
  const clockInstant = Date.parse("2026-10-06T07:30:00Z");
  await page.clock.install({ time: new Date(clockInstant) });
  let reads = 0;
  await page.route("**/api/transport/tracking/", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { status: "unsupported" },
      },
    }),
  );
  await page.route("**/api/transport/observation/**", (route) => {
    reads++;
    const now = clockInstant;
    return route.fulfill({
      json: {
        success: true,
        data: {
          status: "live",
          position: { lat: 50.075, lon: 14.43 },
          delay_seconds: 0,
          cancelled: false,
          observed_at: new Date(now).toISOString(),
          valid_until: new Date(now + 30000).toISOString(),
        },
      },
    });
  });
  await page.goto(path);
  const card = page.locator(".journey-card").first();
  const departure = await card
    .locator(".journey-time")
    .first()
    .getAttribute("datetime");
  expect(Date.parse(departure!)).toBeGreaterThan(clockInstant);
  await card.locator(".journey-summary-toggle").click();
  const dot = card.locator(".leg [data-trip-vehicle-dot]");
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute(
    "aria-label",
    "Vozidlo u zastávky Praha, Muzeum",
  );
  await expect(dot).toHaveAttribute("data-from", "0");
  expect(reads).toBe(1);
  await card.locator("[data-summary-trip]").click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog.locator("[data-trip-vehicle-dot]")).toBeVisible();
  await expect(dialog.locator("[data-trip-vehicle-dot]")).toHaveAttribute(
    "data-from",
    "0",
  );
  expect(reads).toBe(2);
});

test("failed HTTP observation displays unknown delay and unavailable GPS instead of an empty detail", async ({
  page,
}) => {
  await page.route("**/api/transport/search/**", async (route) => {
    const json = await (await route.fetch()).json();
    for (const journey of json.data.journeys)
      for (const leg of journey.legs) {
        leg.realtime = false;
        leg.expectedDeparture = null;
        leg.expectedArrival = null;
        leg.delaySeconds = null;
        leg.predictionValidUntil = null;
      }
    await route.fulfill({ json });
  });
  await page.route("**/api/transport/tracking/", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { status: "disabled" },
      },
    }),
  );
  await page.route("**/api/transport/observation/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await page.goto(path);
  const card = page.locator(".journey-card").first();
  await card.locator(".journey-summary-toggle").click();
  await expect(card.locator("[data-position-status]")).toHaveText(
    "Aktuální poloha není dostupná.",
  );
  await expect(card.locator("[data-delay-status]")).toHaveText(
    "Zpoždění neznámé",
  );
  await expect(card.locator("[data-trip-vehicle-dot]")).toHaveCount(0);
  await card.locator("[data-summary-trip]").click();
  await expect(
    page.locator("[data-trip-dialog] [data-delay-status]"),
  ).toHaveText("Zpoždění neznámé");
});

test("GPS timeline and opening dialog join one pending static detail and reuse it on reopen", async ({
  page,
}) => {
  let staticReads = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/transport/trip/**", async (route) => {
    staticReads++;
    expect(new URL(route.request().url()).searchParams.has("coordinates")).toBe(
      false,
    );
    const response = await route.fetch();
    await ready;
    await route.fulfill({ response });
  });
  await page.route("**/api/transport/tracking/", (route) =>
    route.fulfill({ json: { success: true, data: { status: "unsupported" } } }),
  );
  await page.route("**/api/transport/observation/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          status: "live",
          position: { lat: 50.075, lon: 14.43 },
          delay_seconds: 360,
          cancelled: false,
          observed_at: new Date().toISOString(),
          valid_until: new Date(Date.now() + 30000).toISOString(),
        },
      },
    }),
  );
  try {
    await page.goto(path);
    const card = page.locator(".journey-card").first();
    await card.locator(".journey-summary-toggle").click();
    await expect.poll(() => staticReads).toBe(1);
    await card.locator("[data-summary-trip]").click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog).toBeVisible();
    release();
    await expect(dialog.locator(".trip-call")).toHaveCount(3);
    await expect(dialog.locator(".delay-badge")).toHaveText("Zpoždění 6 min");
    await expect(card.locator(".leg [data-trip-vehicle-dot]")).toBeVisible();
    expect(staticReads).toBe(1);
    await page.keyboard.press("Escape");
    await card.locator("[data-summary-trip]").click();
    await expect(dialog.locator(".trip-call")).toHaveCount(3);
    expect(staticReads).toBe(1);
  } finally {
    release();
  }
});
