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
  test(`trip dot is visible before departure, predicts movement without online data, then follows measured GPS (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date("2026-10-06T07:58:00Z") });
    await page.route("**/api/transport/search/**", async (route) => {
      const json = await (await route.fetch()).json();
      json.data.journeys = json.data.journeys.slice(0, 1);
      await route.fulfill({ json });
    });
    let observations = 0;
    await page.route("**/api/transport/observation/**", (route) => {
      observations++;
      return route.fulfill({
        json: {
          success: true,
          data: {
            status: "unavailable",
            position: null,
            observed_at: null,
            valid_until: null,
            delay_seconds: null,
            cancelled: null,
          },
        },
      });
    });
    await page.route("**/api/transport/tracking/", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            status: "available",
            url: "ws://localhost:4328/timetable-position",
            ticket: route.request().postDataJSON().id,
            expiresAt: "2026-10-06T09:00:00Z",
          },
        },
      }),
    );
    let push: (data: unknown) => void = () => {};
    await page.routeWebSocket("ws://localhost:4328/timetable-position", (ws) =>
      ws.onMessage((message) => {
        const frame = JSON.parse(String(message));
        if (frame.type === "subscribe")
          push = (data) =>
            ws.send(
              JSON.stringify({ type: "observation", trip: frame.ticket, data }),
            );
      }),
    );
    await page.goto(path);
    await page
      .locator(".journey-card")
      .first()
      .locator("[data-summary-trip]")
      .click();
    const dialog = page.locator("[data-trip-dialog]");
    const dot = dialog.locator("[data-trip-vehicle-dot]");
    await expect(dot).toBeVisible();
    await expect(dot).toHaveAttribute("data-from", "0");
    await expect(dot).toHaveAttribute("data-estimated", "true");
    await expect(dot).toHaveAttribute(
      "aria-label",
      /Odhad podle jízdního řádu/,
    );
    await page.clock.pauseAt(new Date("2026-10-06T07:59:00Z"));
    const marker = await dot.elementHandle();
    const row = await dialog.locator(".trip-call").first().elementHandle();
    const times = await dialog.locator(".trip-call time").allTextContents();
    await page.clock.fastForward(210000);
    await expect(dot).toHaveAttribute("data-to", "1");
    await expect(dot).toHaveAttribute("data-fraction", "0.5");
    push({
      status: "live",
      position: { lat: 50.08, lon: 14.421 },
      observed_at: "2026-10-06T08:02:30Z",
      valid_until: "2026-10-06T08:03:00Z",
      delay_seconds: null,
      cancelled: false,
    });
    await expect(dot).not.toHaveAttribute("data-estimated", "true");
    await expect(dot).toHaveAttribute("data-from", "1");
    push({
      status: "unavailable",
      position: null,
      observed_at: null,
      valid_until: null,
      delay_seconds: null,
      cancelled: null,
    });
    await page.clock.fastForward(60000);
    await expect(dot).toBeVisible();
    await expect(dot).toHaveAttribute("data-retained", "true");
    await expect(dot).toHaveAttribute("data-from", "1");
    expect(
      await dot.evaluate((node, previous) => node === previous, marker),
    ).toBe(true);
    expect(
      await dialog
        .locator(".trip-call")
        .first()
        .evaluate((node, previous) => node === previous, row),
    ).toBe(true);
    expect(await dialog.locator(".trip-call time").allTextContents()).toEqual(
      times,
    );
    expect(observations).toBeLessThanOrEqual(2);
  });
}
