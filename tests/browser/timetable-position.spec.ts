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
  test(`realtime axes always show an origin or measured GPS and retain the terminus (${width}px)`, async ({
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
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const missing = {
      status: "unavailable",
      position: null,
      observed_at: null,
      valid_until: null,
      delay_seconds: null,
      cancelled: null,
    };
    await page.route("**/api/transport/observation/**", async (route) => {
      observations++;
      await ready;
      await route.fulfill({ json: { success: true, data: missing } });
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
    let push: ((data: unknown) => void) | undefined;
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
    const sample = async (position: { lat: number; lon: number } | null) => {
      const now = await page.evaluate(() => Date.now());
      return {
        status: "live",
        position,
        observed_at: new Date(now).toISOString(),
        valid_until: new Date(now + 30000).toISOString(),
        delay_seconds: 600,
        cancelled: false,
      };
    };
    try {
      await page.goto(path);
      const card = page.locator(".journey-card").first();
      await card.locator(".journey-summary-toggle").click();
      await card.locator("[data-summary-trip]").click();
      const dialog = page.locator("[data-trip-dialog]");
      const dot = dialog.locator("[data-trip-vehicle-dot]");
      const compactDot = card.locator(".leg [data-trip-vehicle-dot]");
      await expect(dialog.locator(".trip-call")).toHaveCount(3);
      await expect.poll(() => !!push).toBe(true);
      await expect(dialog.locator("[data-response-state]")).toHaveAttribute(
        "data-response-state",
        "pending",
      );
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "0");
      await expect(compactDot).toBeVisible();
      await expect(compactDot).toHaveAttribute("data-from", "0");
      // The timetable has progressed to a different part of the route while
      // the delayed vehicle has not reached even the first stop departure.
      // Advance wall time without expiring the new HTTP timeout: the response
      // is still pending while the independent timetable projection advances.
      await page.clock.setSystemTime(new Date("2026-10-06T08:02:30Z"));
      await page.clock.fastForward(1000);
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "0");
      release();
      await expect(dialog.locator("[data-response-state]")).toHaveAttribute(
        "data-response-state",
        "received",
      );
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "0");
      await expect(compactDot).toBeVisible();
      await expect(compactDot).toHaveAttribute("data-from", "0");
      push!(await sample(null));
      await expect(dialog.locator("[data-delay-status]")).toHaveText(
        "Zpoždění 10 min",
      );
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "0");
      await expect(compactDot).toBeVisible();
      await expect(compactDot).toHaveAttribute("data-from", "0");
      push!(await sample({ lat: 50.075, lon: 14.43 }));
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "0");
      await expect(compactDot).toHaveAttribute("data-fraction", "0");
      await expect(dot).not.toHaveAttribute("data-estimated", "true");
      const marker = await dot.elementHandle();
      const compactMarker = await compactDot.elementHandle();
      const row = await dialog.locator(".trip-call").first().elementHandle();
      const times = await dialog.locator(".trip-call time").allTextContents();
      push!(missing);
      await page.clock.fastForward(60000);
      await expect(dot).toHaveAttribute("data-retained", "true");
      await expect(dot).toHaveAttribute("data-from", "0");
      await expect(compactDot).toHaveAttribute("data-retained", "true");
      await expect(compactDot).toHaveAttribute("data-fraction", "0");
      push!(await sample({ lat: 50.08, lon: 14.421 }));
      await expect(dot).toHaveAttribute("data-from", "1");
      await expect(dot).not.toHaveAttribute("data-retained", "true");
      // A fresh but unassignable/off-route position keeps the last measured
      // stop rather than reverting to the time-based terminal stop.
      push!(await sample({ lat: 49, lon: 14 }));
      await expect(dot).toHaveAttribute("data-retained", "true");
      await expect(dot).toHaveAttribute("data-from", "1");
      await page.clock.fastForward(120000);
      await expect(dot).toHaveAttribute("data-from", "1");
      await expect(dot).not.toHaveAttribute("data-estimated", "true");
      await expect(compactDot).toHaveAttribute("data-retained", "true");
      expect(
        await dot.evaluate((node, previous) => node === previous, marker),
      ).toBe(true);
      expect(
        await compactDot.evaluate(
          (node, previous) => node === previous,
          compactMarker,
        ),
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
      push!(await sample({ lat: 50.085, lon: 14.412 }));
      await expect(dot).toHaveAttribute("data-from", "2");
      await expect(dot).not.toHaveAttribute("data-retained", "true");
      push!(missing);
      await page.clock.fastForward(600000);
      await expect(dot).toBeVisible();
      await expect(dot).toHaveAttribute("data-from", "2");
      await expect(dot).toHaveAttribute("data-retained", "true");
      await expect(compactDot).toBeVisible();
      await expect(compactDot).toHaveAttribute("data-outside", "after");
      expect(observations).toBeLessThanOrEqual(2);
    } finally {
      release();
    }
  });
}
