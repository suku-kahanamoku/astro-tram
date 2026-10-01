import type { Trip } from "../../src/modules/TransportModule/types";
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

test("429 waits for Retry-After and closing/reopening uses the recovered ticket", async ({
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
  expect(requests).toBe(2);
});
