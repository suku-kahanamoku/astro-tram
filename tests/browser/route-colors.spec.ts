import { test, expect } from "@playwright/test";

test("mixed route and its badges use the backend palette, loaded once", async ({
  page,
}) => {
  await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
  const foregrounds = { bus: "#123456", train: "#456789", walk: "#345678" };
  let paletteRequests = 0;
  await page.route("**/api/transport/presentation/**", async (route) => {
    paletteRequests++;
    await route.fulfill({
      json: {
        success: true,
        data: {
          transport: { background: "#eeeeee", foreground: "#111111" },
          ...Object.fromEntries(
            Object.entries(foregrounds).map(([mode, foreground]) => [
              mode,
              { background: "#eeeeee", foreground },
            ]),
          ),
        },
      },
    });
  });
  await page.route("**/api/transport/search/**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const journey = payload.data.journeys[0];
    const original = journey.legs[0];
    journey.legs = Object.keys(foregrounds).map((mode, i) => ({
      ...original,
      mode,
      line: mode === "walk" ? "" : `X${i}`,
      tripId: null,
      geometry: {
        type: "LineString",
        coordinates: [
          [14.4 + i * 0.01, 50.07],
          [14.41 + i * 0.01, 50.08],
        ],
      },
    }));
    payload.data.journeys = [journey];
    await route.fulfill({ json: payload });
  });
  const id = (value: string) =>
    Buffer.from(JSON.stringify(["tram", "pid", "stop", value, null])).toString(
      "base64url",
    );
  const query = new URLSearchParams({
    fromKind: "stop",
    from: id("S1"),
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: id("S2"),
    toLabel: "Praha, Malostranská",
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
    direct: "1",
  });
  await page.goto(`/spojeni/?${query}`);
  await page.locator(".journey-summary").first().click();
  await page.getByRole("link", { name: "Trasa na mapě" }).click();
  const dialog = page.locator("[data-map-dialog]");
  await expect(dialog.locator("canvas").first()).toBeVisible();
  for (const [mode, hex] of Object.entries(foregrounds)) {
    const rgb = hex
      .slice(1)
      .match(/../g)!
      .map((part) => parseInt(part, 16));
    await expect(dialog.locator(`.route-badge[data-mode="${mode}"]`)).toHaveCSS(
      "color",
      `rgb(${rgb.join(", ")})`,
    );
    // Inspect actual rendered vector pixels, not a duplicate map-color implementation.
    await expect
      .poll(() =>
        dialog.locator("canvas").evaluateAll((canvases, expected) => {
          let matching = 0;
          for (const element of canvases) {
            const canvas = element as HTMLCanvasElement;
            const context = canvas.getContext("2d");
            if (!context) continue;
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            ).data;
            for (let i = 0; i < pixels.length; i += 4)
              if (
                pixels[i + 3] > 240 &&
                expected.every(
                  (channel, j) => Math.abs(pixels[i + j] - channel) <= 1,
                )
              )
                matching++;
          }
          return matching;
        }, rgb),
      )
      .toBeGreaterThan(10);
  }
  expect(paletteRequests).toBe(1);
});
