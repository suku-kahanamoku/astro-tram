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
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
    city: "Praha",
  });

/** Centers, rather than row boxes, are the endpoints of the schematic rail. */
async function geometry(axis: Locator) {
  return axis.evaluate((element) => {
    const points = [
      ...element.querySelectorAll<HTMLElement>("[data-trip-point]"),
    ].filter((point) => !point.closest("[inert]"));
    const centers = points.map((point) => {
      const box = point.getBoundingClientRect();
      return box.y + box.height / 2;
    });
    const first = points[0].getBoundingClientRect();
    const railX = points[0].matches(".trip-axis-point")
      ? first.x + first.width / 2
      : first.x + parseFloat(getComputedStyle(points[0], "::before").left);
    const box = element
      .querySelector("[data-trip-vehicle-dot]")!
      .getBoundingClientRect();
    return {
      first: Math.min(...centers),
      last: Math.max(...centers),
      vehicle: box.y + box.height / 2,
      aligned: Math.abs(box.x + box.width / 2 - railX) < 1,
    };
  });
}

async function bounded(axis: Locator, outside?: "before" | "after") {
  const dot = axis.locator("[data-trip-vehicle-dot]");
  await expect(dot).toBeVisible();
  if (outside) {
    await expect(dot).toHaveAttribute("data-outside", outside);
    await expect(dot).toHaveCSS("transition-duration", "0s");
    await expect(dot).toHaveAttribute(
      "aria-label",
      outside === "before"
        ? /^Před zobrazeným úsekem/
        : /^Za zobrazeným úsekem/,
    );
    expect(
      await dot.evaluate(
        (element) => getComputedStyle(element, "::after").content,
      ),
    ).toBe('""');
  } else await expect(dot).not.toHaveAttribute("data-outside");
  await expect
    .poll(async () => {
      const { first, last, vehicle, aligned } = await geometry(axis);
      return (
        aligned &&
        (outside
          ? Math.abs(vehicle - (outside === "before" ? first : last)) < 1
          : vehicle >= first - 0.5 && vehicle <= last + 0.5)
      );
    })
    .toBe(true);
}

for (const width of [390, 1280]) {
  test(`vehicle stays between stop points and outside arrows sit at leg endpoints (${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let index = 0;
    const observation = () => {
      const now = Date.now();
      return {
        status: "live",
        position: { lat: 50 + index * 0.01, lon: 14 },
        observed_at: new Date(now).toISOString(),
        valid_until: new Date(now + 30000).toISOString(),
        delay_seconds: 0,
        cancelled: false,
      };
    };
    await page.route("**/api/transport/search/**", async (route) => {
      const json = await (await route.fetch()).json();
      json.data.journeys = json.data.journeys.slice(0, 1);
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/trip/**", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const ids = ["OUTSIDE1", "S1", "S3", "S2", "OUTSIDE2"];
      json.data.stops = ids.map((id, index) => ({
        stop: {
          id: stopId(id),
          name: `Dlouhý název zastávky ${index} v části hlavního města`,
          lat: 50 + index * 0.01,
          lon: 14,
          platform: null,
        },
        arrival: null,
        departure: null,
      }));
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/observation/**", (route) =>
      route.fulfill({ json: { success: true, data: observation() } }),
    );
    await page.route("**/api/transport/tracking/", (route) =>
      route.fulfill({
        json: {
          success: true,
          data: {
            status: "available",
            url: "ws://localhost:4328/timeline-bounds",
            ticket: route.request().postDataJSON().id,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        },
      }),
    );
    let push: (() => void) | undefined;
    await page.routeWebSocket(
      "ws://localhost:4328/timeline-bounds",
      (socket) => {
        const subscriptions = new Set<string>();
        socket.onMessage((message) => {
          const frame = JSON.parse(String(message));
          if (frame.type !== "subscribe") return;
          subscriptions.add(frame.ticket);
          push = () => {
            for (const trip of subscriptions)
              socket.send(
                JSON.stringify({
                  type: "observation",
                  trip,
                  data: observation(),
                }),
              );
          };
        });
      },
    );
    await page.goto(path);
    const card = page.locator(".journey-card").first();
    await card.locator(".journey-summary-toggle").click();
    const axis = card.locator(".leg-timeline");
    await bounded(axis, "before");
    await expect.poll(() => !!push).toBe(true);
    for (const expanded of [false, true]) {
      if (expanded) {
        await card.locator(".intermediate-toggle").click();
        await expect(card.locator(".intermediate-toggle")).toHaveAttribute(
          "aria-expanded",
          "true",
        );
        await expect(axis.locator(".trip-axis-point")).toHaveCount(1);
      }
      for (const position of [0, 0.5, 1, 1.5, 2, 3, 3.5, 4]) {
        index = position;
        push!();
        await expect(axis.locator("[data-trip-vehicle-dot]")).toHaveAttribute(
          "data-from",
          String(Math.floor(position)),
        );
        const outside =
          position < 1 ? "before" : position > 3 ? "after" : undefined;
        await bounded(axis, outside);
        if (position === 1 || position === 3) {
          await expect
            .poll(async () => {
              const { first, last, vehicle } = await geometry(axis);
              return Math.abs(vehicle - (position === 1 ? first : last));
            })
            .toBeLessThan(1);
        }
        // The full dialog has its own complete rail, without segment arrows.
        await card.locator("[data-summary-trip]").click();
        const dialog = page.locator("[data-trip-dialog]");
        await expect(dialog.locator(".trip-call")).toHaveCount(5);
        await bounded(dialog.locator("[data-trip-timeline]"));
        await expect(dialog.locator("[data-trip-vehicle-dot]")).toHaveAttribute(
          "data-from",
          String(Math.floor(position)),
        );
        if (position === 0 || position === 4) {
          await expect
            .poll(async () => {
              const { first, last, vehicle } = await geometry(
                dialog.locator("[data-trip-timeline]"),
              );
              return Math.abs(vehicle - (position === 0 ? first : last));
            })
            .toBeLessThan(1);
        }
        await dialog.locator("[data-dialog-close]").click();
        await expect(dialog).not.toBeVisible();
        await bounded(axis, outside);
      }
    }
    // Wrapped stop labels and closing intermediate rows change the rail height.
    const monitor = await axis.evaluateHandle((element) => {
      const state = { stop: false, overflow: 0 };
      const sample = () => {
        if (state.stop) return;
        const centers = [
          ...element.querySelectorAll<HTMLElement>("[data-trip-point]"),
        ]
          .filter((point) => !point.closest("[inert]"))
          .map((point) => {
            const box = point.getBoundingClientRect();
            return box.y + box.height / 2;
          });
        const box = element
          .querySelector("[data-trip-vehicle-dot]")!
          .getBoundingClientRect();
        const y = box.y + box.height / 2;
        state.overflow = Math.max(
          state.overflow,
          Math.min(...centers) - y,
          y - Math.max(...centers),
        );
        requestAnimationFrame(sample);
      };
      sample();
      return state;
    });
    await page.setViewportSize({
      width: width === 390 ? 1280 : 390,
      height: 900,
    });
    await bounded(axis, "after");
    await card.locator(".intermediate-toggle").click();
    await expect(card.locator(".intermediate-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(axis.locator(".trip-axis-point")).toHaveCount(0);
    await bounded(axis, "after");
    const overflow = await monitor.evaluate((state) => {
      state.stop = true;
      return state.overflow;
    });
    await monitor.dispose();
    expect(overflow).toBeLessThan(1);
    await page.screenshot({
      path: testInfo.outputPath("vehicle-endpoint.png"),
    });
  });
}
