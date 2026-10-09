import { test, expect } from "@playwright/test";

test("street suggestion opens the existing map and submits a coordinate destination", async ({
  page,
}) => {
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "street_public_id",
            name: "Česká",
            kind: "street",
            city: "Brno",
            lat: 49.2,
            lon: 16.6,
            platform: null,
            sourceMode: "index",
          },
        ],
      },
    }),
  );
  await page.route("**/*tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await page.locator("#place-from").fill("Čes");
  await page.getByRole("option", { name: /Česká/ }).click();
  await expect(page.locator('[data-map="from"]')).toBeEnabled();
  await page.locator('[data-map="from"]').click();
  await expect(
    page.locator("[data-map-canvas] .ol-viewport canvas"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#place-to").fill("Muz");
  await page.getByRole("option", { name: /Česká/ }).click();
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  await expect(page).toHaveURL(/fromKind=coordinates/);
  await expect(page).toHaveURL(/fromLat=49.2/);
});
