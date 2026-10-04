import { test, expect, type Locator } from "@playwright/test";

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
    country: "CZ",
    city: "Praha",
    at: "2026-10-06T08:00:00Z",
  });
const calls = Array.from({ length: 5 }, (_, i) => ({
  stop: {
    id: stopId(`P${i}`),
    name: `Zastávka ${i}`,
    lat: 50 + i * 0.01,
    lon: 14,
    platform: null,
  },
  arrival: `2026-10-06T08:${String(i * 5).padStart(2, "0")}:00Z`,
  departure: `2026-10-06T08:${String(i * 5).padStart(2, "0")}:00Z`,
}));

async function center(element: Locator) {
  const bounds = (await element.boundingBox())!;
  return bounds.y + bounds.height / 2;
}

for (const width of [375, 1280])
  for (const mode of [
    "tram",
    "bus",
    "trolleybus",
    "metro",
    "train",
    "coach",
    "ferry",
  ])
    test(`${mode} accordion aligns its position with expanded stops and marks progress outside the leg (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      let sample = 2;
      const lastKnown = mode === "tram";
      await page.route("**/api/transport/search/**", async (route) => {
        const json = await (await route.fetch()).json();
        const journey = json.data.journeys[0],
          leg = journey.legs[0];
        Object.assign(leg, {
          mode,
          from: calls[1].stop,
          to: calls[3].stop,
          scheduledDeparture: calls[1].departure,
          scheduledArrival: calls[3].arrival,
        });
        json.data.journeys = [journey];
        await route.fulfill({ json });
      });
      await page.route("**/api/transport/trip/**", (route) =>
        route.fulfill({
          json: {
            success: true,
            data: { sourceMode: "schedule", stops: calls },
          },
        }),
      );
      await page.route("**/api/transport/tracking/", (route) =>
        route.fulfill({
          json: { success: true, data: { status: "disabled" } },
        }),
      );
      await page.route("**/api/transport/observation/**", (route) => {
        const now = Date.now();
        return route.fulfill({
          json: {
            success: true,
            data: {
              status: lastKnown ? "last_known" : "live",
              position: { lat: calls[sample].stop.lat, lon: 14 },
              observed_at: new Date(
                now - (lastKnown ? 40000 : 0),
              ).toISOString(),
              valid_until: new Date(now + 30000).toISOString(),
              delay_seconds: lastKnown ? null : 60,
              cancelled: false,
            },
          },
        });
      });
      await page.goto(path);
      const card = page.locator(".journey-card").first();
      const toggle = card.locator(".journey-summary-toggle");
      await toggle.click();
      const axis = card.locator(".leg-timeline"),
        dot = axis.locator("[data-trip-vehicle-dot]");
      await expect(dot).toBeVisible();
      await expect(dot).not.toHaveAttribute("data-outside");
      await expect(dot).toHaveAttribute("data-from", "2");
      if (lastKnown) await expect(dot).toHaveAttribute("data-retained", "true");
      const collapsedCenter = async () =>
        ((await center(axis.locator('time[data-trip-point="0"]'))) +
          (await center(axis.locator('time[data-trip-point="1"]')))) /
        2;
      await expect
        .poll(async () =>
          Math.abs((await center(dot)) - (await collapsedCenter())),
        )
        .toBeLessThan(1);
      const stopsToggle = card.locator(".intermediate-toggle");
      await stopsToggle.click();
      const middle = axis.locator('.trip-axis-point[data-trip-point="2"]');
      await expect(middle).toBeVisible();
      expect(
        await middle.evaluate((point) => {
          const clipping = point
            .closest(".disclosure-motion")!
            .getBoundingClientRect();
          return point.getBoundingClientRect().left >= clipping.left;
        }),
      ).toBe(true);
      await expect
        .poll(async () =>
          Math.abs((await center(dot)) - (await center(middle))),
        )
        .toBeLessThan(1);
      await stopsToggle.click();
      await expect(middle).toBeHidden();
      await expect
        .poll(async () =>
          Math.abs((await center(dot)) - (await collapsedCenter())),
        )
        .toBeLessThan(1);

      sample = 4;
      await toggle.click();
      await expect(card.locator(".journey-detail")).toBeHidden();
      await toggle.click();
      await expect(dot).toHaveAttribute("data-outside", "after");
      await expect(dot).toHaveAttribute(
        "title",
        /Za zobrazeným úsekem.*Zastávka 4/,
      );
      await expect
        .poll(
          async () =>
            (await center(dot)) -
            (await center(axis.locator('time[data-trip-point="1"]'))),
        )
        .toBeGreaterThan(10);
      await card.locator("[data-summary-trip]").first().click();
      const dialogDot = page.locator(
        "[data-trip-dialog] [data-trip-vehicle-dot]",
      );
      await expect(dialogDot).toHaveAttribute("data-from", "4");
      await expect(dialogDot).not.toHaveAttribute("data-outside");
      await page.keyboard.press("Escape");

      sample = 0;
      await toggle.click();
      await expect(card.locator(".journey-detail")).toBeHidden();
      await toggle.click();
      await expect(dot).toHaveAttribute("data-outside", "before");
      await expect(dot).toHaveAttribute(
        "title",
        /Před zobrazeným úsekem.*Zastávka 0/,
      );
      await expect
        .poll(
          async () =>
            (await center(axis.locator('time[data-trip-point="0"]'))) -
            (await center(dot)),
        )
        .toBeGreaterThan(10);
    });
