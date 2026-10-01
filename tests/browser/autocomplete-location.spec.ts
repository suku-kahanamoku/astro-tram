import { test, expect } from "@playwright/test";

for (const failure of ["denied", "stale", "pending"] as const) {
  test(`text autocomplete remains usable with ${failure} GPS`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(
            success: (p: unknown) => void,
            error: (e: unknown) => void,
          ) {
            if (mode === "denied") error({ code: 1 });
            if (mode === "stale")
              success({
                timestamp: Date.now() - 60000,
                coords: { latitude: 49.195, longitude: 16.61 },
              });
            // A pending permission prompt must not leave search waiting forever.
          },
        },
      });
    }, failure);
    await page.goto("/");
    const pending = page.waitForRequest((r) =>
      r.url().includes("/api/transport/places/"),
    );
    await page.locator("#place-from").fill("Muzeum");
    const request = await pending;
    expect(request.method()).toBe("GET");
    expect(JSON.parse(new URL(request.url()).searchParams.get("q")!)).toEqual({
      name: { $regex: "Muzeum" },
      state: "CZ",
    });
    await expect(
      page.getByRole("option", { name: "Praha, Muzeum", exact: true }),
    ).toBeVisible();
    await expect(page.locator("[data-form-error]")).toBeHidden();
  });
}

test("both place fields get fresh ranking GPS and preserve the backend order without storing the fix", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.195, longitude: 16.61 });
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          { id: "near", name: "Brno, Tábor", sourceMode: "live" },
          { id: "far", name: "Tábor", sourceMode: "live" },
        ],
      },
    }),
  );
  await page.goto("/?scopeLocation=1"); // Old links no longer activate a separate area mode.
  await expect(page.locator("[data-scope-location]")).toHaveCount(0);
  for (const [side, lat] of [
    ["from", 49.195],
    ["to", 49.21],
  ] as const) {
    await context.setGeolocation({ latitude: lat, longitude: 16.61 });
    const pending = page.waitForRequest((r) =>
      r.url().includes("/api/transport/places/"),
    );
    await page.locator(`#place-${side}`).fill("tab");
    const request = await pending;
    expect(request.method()).toBe("POST");
    expect(new URL(request.url()).search).toBe("");
    expect(request.postDataJSON().q.latitude).toBe(lat);
    expect(request.postDataJSON().q.name.$regex).toBe("tab");
    await expect(page.locator(`#suggestions-${side} [role=option]`)).toHaveText(
      ["Brno, Tábor", "Tábor"],
    );
    await page.locator(`#suggestions-${side} [role=option]`).first().click();
  }
  const stored = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(stored).not.toMatch(/49\.195|49\.21|16\.61|observed_at/);
  expect(page.url()).not.toMatch(/49\.195|49\.21|16\.61/);
});
