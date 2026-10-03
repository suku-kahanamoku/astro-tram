import type { Trip } from "../../src/modules/TransportCoreModule/types";
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

test("opening and reopening a trip draws an HTTP position before any websocket message", async ({
  page,
}) => {
  let reads = 0,
    messages = 0,
    subscribed = 0;
  await page.route("**/api/transport/observation/**", async (route) => {
    reads++;
    const now = Date.now();
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "live",
          position: { lat: 50.076, lon: 14.4282 },
          observed_at: new Date(now).toISOString(),
          valid_until: new Date(now + 30000).toISOString(),
          delay_seconds: 120,
          cancelled: false,
        },
      },
    });
  });
  await page.route("**/api/transport/tracking/", async (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/initial-position",
          ticket: route.request().postDataJSON().id,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    }),
  );
  let push = () => {};
  await page.routeWebSocket("ws://localhost:4328/initial-position", (ws) =>
    ws.onMessage((message) => {
      const m = JSON.parse(String(message));
      if (m.type !== "subscribe") return;
      subscribed++;
      push = () => {
        messages++;
        const now = Date.now();
        ws.send(
          JSON.stringify({
            type: "observation",
            trip: m.ticket,
            data: {
              status: "live",
              position: { lat: 50.077, lon: 14.4264 },
              observed_at: new Date(now).toISOString(),
              valid_until: new Date(now + 30000).toISOString(),
              delay_seconds: 180,
              cancelled: false,
            },
          }),
        );
      };
    }),
  );
  await page.goto(path);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  expect(reads).toBe(0);
  await page.locator(".journey-summary-toggle").first().click();
  await expect.poll(() => subscribed).toBe(1);
  const badge = page.locator("[data-summary-trip]").first();
  await badge.click();
  const dialog = page.locator("[data-trip-dialog]");
  const dot = dialog.locator("[data-trip-vehicle-dot]");
  await expect(dot).toBeVisible();
  expect(reads).toBe(1);
  expect(messages).toBe(0);
  await expect(dialog.locator(".delay-badge")).toContainText("2 min");
  const row = await dialog.locator(".trip-call").first().elementHandle();
  push();
  await expect(dialog.locator(".delay-badge")).toContainText("3 min");
  expect(
    await dialog
      .locator(".trip-call")
      .first()
      .evaluate((el, previous) => el === previous, row),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await badge.click();
  await expect.poll(() => reads).toBe(2);
  await expect(dot).toBeVisible();
  expect(subscribed, "opening an already watched trip keeps its socket").toBe(
    1,
  );
});

test("several accordions and dialogs multiplex all trips over one socket", async ({
  page,
}) => {
  let connections = 0;
  const subscriptions = new Set<string>();
  const events: { type: string; trip: string }[] = [];
  await page.route("**/api/transport/search/**", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const first = json.data.journeys[0];
    const second = structuredClone(first);
    second.key = "another-journey";
    second.legs[0].tripId = "another-trip";
    json.data.journeys = [first, second];
    await route.fulfill({ json });
  });
  await page.route("**/api/transport/tracking/", async (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/multiplex",
          ticket: route.request().postDataJSON().id,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    }),
  );
  await page.routeWebSocket("ws://localhost:4328/multiplex", (ws) => {
    connections++;
    ws.onMessage((message) => {
      const value = JSON.parse(String(message));
      if (value.type === "subscribe") {
        subscriptions.add(value.ticket);
        events.push({ type: value.type, trip: value.ticket });
        const now = Date.now();
        ws.send(
          JSON.stringify({
            type: "observation",
            trip: value.ticket,
            data: {
              status: "live",
              position: { lat: 50.076, lon: 14.4282 },
              observed_at: new Date(now).toISOString(),
              valid_until: new Date(now + 30000).toISOString(),
              delay_seconds: value.ticket === "another-trip" ? 180 : 60,
              cancelled: false,
            },
          }),
        );
      } else if (value.type === "unsubscribe") {
        subscriptions.delete(value.trip);
        events.push(value);
      }
    });
  });
  await page.goto(path);
  const cards = page.locator(".journey-card");
  await expect(cards).toHaveCount(2);
  await cards.nth(0).locator(".journey-summary-toggle").click();
  await cards.nth(1).locator(".journey-summary-toggle").click();
  await expect.poll(() => subscriptions.size).toBe(2);
  expect(connections).toBe(1);
  await expect(cards.nth(0).locator(".leg .delay-badge").first()).toContainText(
    "1 min",
  );
  await expect(cards.nth(1).locator(".leg .delay-badge").first()).toContainText(
    "3 min",
  );
  await cards.nth(0).locator("[data-summary-trip]").first().click();
  await expect(
    page.locator("[data-trip-dialog] [data-trip-vehicle-dot]"),
  ).toBeVisible();
  expect(connections).toBe(1);
  await page.keyboard.press("Escape");
  await cards.nth(0).locator(".journey-summary-toggle").click();
  await expect.poll(() => subscriptions.size).toBe(1);
  expect(events.at(-1)?.type).toBe("unsubscribe");
  await cards.nth(0).locator(".journey-summary-toggle").click();
  await expect.poll(() => subscriptions.size).toBe(2);
  expect(connections).toBe(1);
});

test("legacy detail parameters do not reopen cards; interactions leave URL and history unchanged", async ({
  page,
}) => {
  let searches = 0,
    trips = 0,
    tickets = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/transport/search/")) searches++;
    if (request.url().includes("/api/transport/trip/")) trips++;
    if (request.url().includes("/api/transport/tracking/")) tickets++;
  });
  await page.goto(path);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  const keys = await page
    .locator(".journey-card")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-journey")));
  await page.goto(
    path + `&expanded=${keys.join(",")}&journey=${keys[0]}&leg=0`,
  );
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await expect(page.locator("[data-trip-dialog]")).not.toBeVisible();
  expect(trips).toBe(0);
  expect(tickets).toBe(0);
  const url = page.url(),
    historyLength = await page.evaluate(() => history.length);
  await page.locator(".journey-summary-toggle").first().click();
  await page.locator(".journey-summary-toggle").last().click();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(2);
  await page.locator("[data-summary-trip]").first().click();
  await expect(page.locator("[data-trip-dialog] .trip-call")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page.locator(".intermediate-toggle").first().click();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(searches).toBe(2);
  expect(trips).toBe(1);
});

test("static stop rows appear before optional coordinates and never remount when GPS arrives", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let coordinateRequests = 0,
    staticRequests = 0;
  await page.route("**/api/transport/trip/**", async (route) => {
    const coordinates =
      new URL(route.request().url()).searchParams.get("coordinates") === "1";
    const payload = await (await route.fetch()).json();
    payload.data.stops.forEach((call: Trip["stops"][number], i: number) => {
      call.stop.lat = coordinates ? 50 + i * 0.002 : null;
      call.stop.lon = coordinates ? 14 : null;
    });
    if (coordinates) {
      coordinateRequests++;
      await held;
    } else staticRequests++;
    await route.fulfill({ json: payload });
  });
  await page.route("**/api/transport/tracking/", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/separate-position",
          ticket: route.request().postDataJSON().id,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    });
  });
  let push = () => {};
  await page.routeWebSocket("ws://localhost:4328/separate-position", (ws) => {
    ws.onMessage((message) => {
      const m = JSON.parse(String(message));
      if (m.type !== "subscribe") return;
      push = () =>
        ws.send(
          JSON.stringify({
            type: "observation",
            trip: m.ticket,
            data: {
              status: "live",
              position: { lat: 50.001, lon: 14 },
              observed_at: new Date().toISOString(),
              valid_until: new Date(Date.now() + 30000).toISOString(),
              delay_seconds: 120,
              cancelled: false,
            },
          }),
        );
      push();
    });
  });
  try {
    await page.goto(path);
    await page.locator("[data-summary-trip]").first().click();
    const rows = page.locator("[data-trip-dialog] .trip-call");
    await expect(rows).toHaveCount(3);
    await expect.poll(() => coordinateRequests).toBe(1);
    const firstRow = await rows.first().elementHandle();
    await expect(page.locator("[data-trip-vehicle-dot]")).toHaveCount(0);
    release();
    await expect(page.locator("[data-trip-vehicle-dot]")).toBeVisible();
    push();
    expect(
      await rows.first().evaluate((node, before) => node === before, firstRow),
    ).toBe(true);
    expect(staticRequests).toBe(1);
    expect(coordinateRequests).toBe(1);
  } finally {
    release();
  }
});

test("429 waits for Retry-After and closing/reopening obtains a fresh ticket", async ({
  page,
}) => {
  let requests = 0,
    connections = 0;
  await page.route("**/api/transport/tracking/", async (route) => {
    if (++requests === 1) {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "2" },
        json: { success: false, error: "rate_limited" },
      });
      return;
    }
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/quota-recovery",
          ticket: route.request().postDataJSON().id,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    });
  });
  await page.routeWebSocket("ws://localhost:4328/quota-recovery", () => {
    connections++;
  });
  await page.goto(path);
  const badge = page.locator("[data-summary-trip]").first();
  await badge.click();
  await expect(page.locator("[data-trip-dialog] .trip-call")).toHaveCount(3);
  await expect.poll(() => requests).toBe(1);
  await page.waitForTimeout(500); // Deliberately shorter than the advertised cooldown.
  expect(requests).toBe(1);
  await expect.poll(() => connections).toBe(1);
  expect(requests).toBe(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-trip-dialog]")).not.toBeVisible();
  await badge.click();
  await expect.poll(() => connections).toBe(2);
  expect(requests).toBe(3);
});
