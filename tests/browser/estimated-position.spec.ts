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
  test(`backend timetable progress is labelled in accordion and dialog, moves over WS and expires (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    let reads = 0,
      coordinateReads = 0;
    const estimate = (fraction = 0, atStop = true) => {
      const now = Date.now();
      return {
        status: "estimated",
        position: null,
        delay_seconds: null,
        cancelled: null,
        observed_at: new Date(now).toISOString(),
        valid_until: new Date(now + 30000).toISOString(),
        estimated_progress: {
          from_index: 0,
          to_index: atStop ? 0 : 1,
          from_stop_id: stopId("S1"),
          to_stop_id: stopId(atStop ? "S1" : "S2"),
          from_departure: "2026-10-06T08:00:00Z",
          to_arrival: atStop ? "2026-10-06T08:00:00Z" : "2026-10-06T08:05:00Z",
          fraction,
          at_stop: atStop,
          observed_at: new Date(now).toISOString(),
          valid_until: new Date(now + 30000).toISOString(),
        },
      };
    };
    await page.route("**/api/transport/search/**", async (route) => {
      const json = await (await route.fetch()).json();
      for (const journey of json.data.journeys)
        for (const leg of journey.legs)
          Object.assign(leg, {
            realtime: false,
            expectedDeparture: null,
            expectedArrival: null,
            predictionValidUntil: null,
            delaySeconds: null,
          });
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/trip/**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("coordinates"))
        coordinateReads++;
      const json = await (await route.fetch()).json();
      for (const call of json.data.stops)
        Object.assign(call.stop, { lat: null, lon: null });
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/observation/**", (route) => {
      reads++;
      return route.fulfill({ json: { success: true, data: estimate() } });
    });
    await page.route("**/api/transport/tracking/", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            status: "available",
            url: "ws://localhost:4328/estimated-progress",
            ticket: route.request().postDataJSON().id,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        },
      }),
    );
    let push: (value: unknown) => void = () => {};
    await page.routeWebSocket("ws://localhost:4328/estimated-progress", (ws) =>
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
    const card = page.locator(".journey-card").first();
    await card.locator(".journey-summary-toggle").click();
    const compactDot = card.locator(".leg [data-trip-vehicle-dot]");
    await expect(compactDot).toBeVisible();
    await expect(compactDot).toHaveAttribute("data-estimated", "true");
    await expect(compactDot).toHaveAttribute(
      "title",
      /Odhad podle jízdního řádu; nejde o skutečnou polohu vozidla/,
    );
    await expect(card.locator(".leg [data-delay-status]")).toHaveText(
      "Zpoždění neznámé",
    );
    expect(reads).toBe(1);
    await card.locator("[data-summary-trip]").click();
    const dialog = page.locator("[data-trip-dialog]");
    const dot = dialog.locator("[data-trip-vehicle-dot]");
    await expect(dot).toBeVisible();
    await expect(dot).toHaveAttribute("data-estimated", "true");
    await expect(dot).toHaveAttribute(
      "aria-label",
      /Odhad.*Vozidlo u zastávky Praha, Muzeum/,
    );
    await expect(dialog.locator("[data-position-status]")).toHaveText(
      "Odhad polohy podle jízdního řádu",
    );
    expect(reads).toBe(2);
    const row = await dialog.locator(".trip-call").first().elementHandle();
    push(estimate(0.75, false));
    await expect(dot).toHaveAttribute("data-fraction", "0.75");
    await expect(compactDot).toHaveAttribute("data-fraction", "0.75");
    await expect(dot).toHaveAttribute(
      "title",
      /nejde o skutečnou polohu.*mezi zastávkami/,
    );
    expect(
      await dialog
        .locator(".trip-call")
        .first()
        .evaluate((node, before) => node === before, row),
    ).toBe(true);
    await expect(dialog.locator(".delay-badge")).toHaveCount(0);
    expect(coordinateReads).toBe(0);
    expect(reads).toBe(2);
    await page.clock.fastForward(31000);
    await expect(dot).toHaveCount(0);
    await expect(compactDot).toHaveCount(0);
  });
}
