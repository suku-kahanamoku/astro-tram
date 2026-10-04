import { test, expect, type Locator } from "@playwright/test";

const id = (kind: string, value: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", kind, value, null])).toString(
    "base64url",
  );
const stop = (name: string) => ({
  id: id("stop", name),
  name,
  lat: 49.2,
  lon: 16.6,
  platform: null,
});
const calls = (names: string[], times: string[]) =>
  names.map((name, i) => ({
    stop: stop(name),
    arrival: times[i],
    departure: times[i],
    requestStop: i === 1,
  }));
const firstCalls = calls(
  ["Výchozí zastávka", "Před půlnocí", "Po půlnoci", "Přestup"],
  [
    "2026-10-04T23:45:00+02:00",
    "2026-10-04T23:55:00+02:00",
    "2026-10-05T00:00:00+02:00",
    "2026-10-05T00:05:00+02:00",
  ],
);
const secondCalls = calls(
  ["Přestup", "Noční mezizastávka", "Výstup"],
  [
    "2026-10-05T00:12:00+02:00",
    "2026-10-05T00:20:00+02:00",
    "2026-10-05T00:35:00+02:00",
  ],
);
const path =
  "/spojeni/?" +
  new URLSearchParams({
    fromKind: "stop",
    from: id("stop", "S1"),
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: id("stop", "S2"),
    toLabel: "Praha, Malostranská",
    at: "2026-10-04T21:31:00Z",
    country: "CZ",
  });

async function expectErrorClocks(clocks: Locator, count: number) {
  await expect(clocks).toHaveCount(count);
  for (const clock of await clocks.all()) {
    await expect(clock).toHaveAttribute("data-next-day", "true");
    await expect(clock).toHaveCSS("color", "rgb(204, 52, 42)");
  }
}

for (const width of [375, 1280])
  test(`midnight colors only clocks in summary, all legs, intermediate stops and both trip dialogs (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/transport/search/**", async (route) => {
      const json = await (await route.fetch()).json();
      const journey = json.data.journeys[0],
        template = journey.legs[0];
      const leg = (rows: typeof firstCalls, trip: string, line: string) => ({
        ...template,
        tripId: id("trip", trip),
        mode: "bus",
        line,
        from: rows[0].stop,
        to: rows.at(-1)!.stop,
        scheduledDeparture: rows[0].departure,
        scheduledArrival: rows.at(-1)!.arrival,
      });
      const after = leg(secondCalls, "MIDNIGHT-2", "N90");
      journey.legs = [
        leg(firstCalls, "MIDNIGHT-1", "N89"),
        after,
        {
          ...after,
          mode: "walk",
          tripId: null,
          line: null,
          from: secondCalls.at(-1)!.stop,
          to: stop("Cíl pěšky"),
          scheduledDeparture: "2026-10-05T00:35:00+02:00",
          scheduledArrival: "2026-10-05T00:37:00+02:00",
        },
      ];
      json.data.journeys = [
        journey,
        { ...journey, key: "starts-next-day", legs: [after] },
      ];
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/trip/**", (route) => {
      const trip = new URL(route.request().url()).searchParams.get("id");
      return route.fulfill({
        json: {
          success: true,
          data: {
            sourceMode: "schedule",
            stops: trip === id("trip", "MIDNIGHT-1") ? firstCalls : secondCalls,
          },
        },
      });
    });
    await page.goto(path);
    const card = page.locator(".journey-card").first();
    await expect(card.locator(".journey-route time").first()).toHaveText(
      "23:45",
    );
    await expect(
      card.locator(".journey-route time").first(),
    ).not.toHaveAttribute("data-next-day");
    await expectErrorClocks(
      card.locator(".journey-route time[data-next-day]"),
      1,
    );
    await card.locator(".journey-summary-toggle").click();
    await expectErrorClocks(
      card.locator(".leg-stops > time[data-next-day]"),
      5,
    );
    for (const index of [0, 1]) {
      await card.locator(".intermediate-toggle").nth(index).click();
      const middle = card.locator(`[data-intermediate-stops="${index}"]`);
      await expect(middle.locator(".trip-call")).toHaveCount(
        index === 0 ? 2 : 1,
      );
      await expectErrorClocks(middle.locator("time[data-next-day]"), 1);
      for (const label of await middle.locator(".trip-stop-name").all())
        await expect(label).not.toHaveCSS("color", "rgb(204, 52, 42)");
      await card.locator("[data-trip-open]").nth(index).click();
      const dialog = page.locator("[data-trip-dialog]");
      await expectErrorClocks(
        dialog.locator("time[data-next-day]"),
        index === 0 ? 2 : 3,
      );
      await page.keyboard.press("Escape");
    }
    // A new itinerary beginning after midnight has its own baseline, even with the same trip.
    const next = page.locator(".journey-card").nth(1);
    await expect(next.locator("time[data-next-day]")).toHaveCount(0);
    await next.locator("[data-summary-trip]").click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog.locator(".trip-call")).toHaveCount(3);
    await expect(dialog.locator("time[data-next-day]")).toHaveCount(0);
  });

test("page, autocomplete, city lists, dialog and mobile menu use the current primary scrollbar color", async ({
  page,
}) => {
  const assertBrand = async (element: Locator) => {
    await expect(element).toHaveCSS(
      "scrollbar-color",
      "rgb(237, 72, 59) rgb(255, 253, 248)",
    );
    await expect(element).toHaveCSS("scrollbar-width", "thin");
  };
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: Array.from({ length: 25 }, (_, i) => ({
          ...stop(`Zastávka ${i}`),
          sourceMode: "schedule",
          modes: ["bus"],
        })),
      },
    }),
  );
  await page.goto("/");
  await assertBrand(page.locator("html"));
  await page.locator("#place-from").fill("Zastávka");
  const places = page.locator("#suggestions-from");
  await expect(places).toBeVisible();
  await assertBrand(places);
  expect(await places.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await page.locator("#travel-city").click();
  const cities = page.locator("#city-options");
  await expect(cities).toBeVisible();
  await assertBrand(cities);
  expect(await cities.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await page.keyboard.press("Escape");
  await page.goto(path);
  await page.locator("[data-summary-trip]").first().click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog).toBeVisible();
  await assertBrand(dialog);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 375, height: 700 });
  await page.evaluate(async () => {
    const path = "/tests/react-harness.tsx";
    const harness = await import(/* @vite-ignore */ path);
    (window as any).unmountReactHarness = harness.mountHarness();
  });
  const harness = page.locator("#react-test-harness");
  await harness.getByRole("button", { name: "Open test menu" }).click();
  await assertBrand(harness.locator(".mobile-nav"));
  // Changing the theme token must reach existing and future scrolling containers.
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--primary", "#2563eb"),
  );
  await expect(page.locator("html")).toHaveCSS(
    "scrollbar-color",
    "rgb(37, 99, 235) rgb(255, 253, 248)",
  );
  await expect(harness.locator(".mobile-nav")).toHaveCSS(
    "scrollbar-color",
    "rgb(37, 99, 235) rgb(255, 253, 248)",
  );
  await page.evaluate(() => (window as any).unmountReactHarness());
});
