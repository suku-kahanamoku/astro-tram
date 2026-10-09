import { test, expect } from "@playwright/test";
const id = (external: string) =>
  Buffer.from(
    JSON.stringify(["tram", "otp", "stop", external, null, "a".repeat(64)]),
  ).toString("base64url");
test("submitting unselected Brno and Praha uses municipalities despite a nearer GPS suggestion", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  await page.route("**/api/transport/places/**", async (route) => {
    const req = route.request();
    const q =
      req.method() === "POST"
        ? req.postDataJSON().q
        : JSON.parse(new URL(req.url()).searchParams.get("q")!);
    const name = q.name?.$regex?.trim().toLowerCase();
    const city = name === "praha" ? "Praha" : "Brno";
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: id(`${city}-city`),
            kind: "city",
            name: city,
            state: "CZ",
            lat: 49.2,
            lon: 16.6,
            sourceMode: "index",
          },
          {
            id: id(`${city}-near`),
            kind: "stop",
            name: `${city}, park`,
            state: "CZ",
            lat: 49.2,
            lon: 16.6,
            sourceMode: "index",
          },
          {
            id: id(`${city}-main`),
            kind: "stop",
            name: `${city}, hlavní nádraží`,
            cityStation: true,
            matchedCity: city,
            stationPriority: 0,
            state: "CZ",
            lat: 49.2,
            lon: 16.6,
            sourceMode: "index",
          },
        ],
      },
    });
  });
  await page.route("**/api/transport/search/**", async (route) =>
    route.fulfill({
      json: { success: true, data: { journeys: [], partial: false } },
    }),
  );
  await page.goto("/");
  await page.locator("#place-from").fill("brno");
  await page.locator("#place-to").fill("praha");
  await page.locator("#place-to").press("Escape");
  const searched = page.waitForRequest(
    (r) => r.url().includes("/api/transport/search/") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  const request = await searched;
  expect(request.postDataJSON()["from-dest"]).toEqual({
    type: "municipality",
    name: "Brno",
    state: "CZ",
  });
  expect(request.postDataJSON()["to-dest"]).toEqual({
    type: "municipality",
    name: "Praha",
    state: "CZ",
  });
  expect(page.url()).not.toMatch(/fromKind=current_location|fromText=|toText=/);
  await expect(page.locator("#place-from")).toHaveValue("Brno");
  await expect(page.locator("#place-to")).toHaveValue("Praha");
});
