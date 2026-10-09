import { test, expect } from "@playwright/test";

test("browser reuses static transport responses and always fetches observations, tickets and GPS queries", async ({
  page,
}) => {
  const reads = {
    trip: 0,
    coordinates: 0,
    observation: 0,
    tracking: 0,
    citiesGps: 0,
  };
  await page.route("**/api/transport/trip/**", (route) => {
    const coordinates = new URL(route.request().url()).searchParams.has(
      "coordinates",
    );
    reads[coordinates ? "coordinates" : "trip"]++;
    return route.fulfill({
      json: {
        success: true,
        data: { stops: [{ stop: { name: "Static stop" } }] },
      },
    });
  });
  await page.route("**/api/transport/observation/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { status: "available", delay_seconds: ++reads.observation * 60 },
      },
    }),
  );
  await page.route("**/api/transport/tracking/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: { status: "available", ticket: String(++reads.tracking) },
      },
    }),
  );
  await page.route("**/api/transport/cities/**", async (route) => {
    if (route.request().method() === "POST") reads.citiesGps++;
    await route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // Vite loads the production provider as a browser module; no Node/SSR bypass.
    const path = "/src/modules/TransportCoreModule/providers/client.ts";
    const { transportClient } = await import(/* @vite-ignore */ path);
    const signal = new AbortController().signal;
    const [first, second] = await Promise.all([
      transportClient.trip("cache-test-revision", signal),
      transportClient.trip("cache-test-revision", signal),
    ]);
    first.stops[0].stop.name = "Mutated by consumer";
    const third = await transportClient.trip("cache-test-revision", signal);
    await Promise.all([
      transportClient.tripCoordinates("cache-test-revision", signal),
      transportClient.tripCoordinates("cache-test-revision", signal),
    ]);
    const observations = [
      await transportClient.observation("cache-test-revision", signal),
      await transportClient.observation("cache-test-revision", signal),
    ];
    const tickets = [
      await transportClient.tracking("cache-test-revision", signal),
      await transportClient.tracking("cache-test-revision", signal),
    ];
    const fix = { lat: 49.2, lon: 16.6, observedAt: new Date().toISOString() };
    await transportClient.cities("CZ", signal, fix);
    await transportClient.cities("CZ", signal, fix);
    return {
      secondName: second.stops[0].stop.name,
      thirdName: third.stops[0].stop.name,
      observations,
      tickets,
    };
  });
  expect(reads).toEqual({
    trip: 1,
    coordinates: 1,
    observation: 2,
    tracking: 2,
    citiesGps: 2,
  });
  expect(result.secondName).toBe("Static stop");
  expect(result.thirdName).toBe("Static stop");
  expect(result.observations[0].delay_seconds).toBe(60);
  expect(result.observations[1].delay_seconds).toBe(120);
  expect(result.tickets[0].ticket).not.toBe(result.tickets[1].ticket);
});
