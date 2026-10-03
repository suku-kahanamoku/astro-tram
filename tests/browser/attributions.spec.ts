import { expect, test } from "@playwright/test";

test("footer renders only active backend sources, exact credits, update dates and external links", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/transport/attributions/");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.success).toBe(true);
  expect(payload.data).toHaveLength(2);
  expect(JSON.stringify(payload)).not.toMatch(
    /DO_NOT_EXPOSE|private_token|api_key/,
  );
  await page.goto("/");
  const credits = page.locator("footer [data-transport-attributions]");
  await expect(credits).toBeVisible();
  await expect(credits.locator(".attribution-processing")).toHaveText(
    "Data byla zpracována pro vyhledávání a zobrazení v aplikaci TRAM.",
  );
  await expect(credits.locator("[data-attribution-source]")).toHaveCount(2);
  await expect(
    credits.getByText("Syntetická data pro testování TRAM.", { exact: true }),
  ).toBeVisible();
  await expect(
    credits.getByText("Tato data nejsou skutečný jízdní řád.", { exact: true }),
  ).toBeVisible();
  await expect(
    credits.getByText("© OpenStreetMap contributors", { exact: true }),
  ).toBeVisible();
  await expect(
    credits.locator('time[datetime="2026-10-03T08:00:00Z"]'),
  ).toBeVisible();
  const links = credits.locator("a");
  await expect(links).toHaveCount(4);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link.locator('svg[data-mode="external"]')).toHaveCount(1);
  }
  await page.goto("/en/");
  await expect(page.locator("[data-transport-attributions] h2")).toHaveText(
    "Transport and map data sources",
  );
  await expect(
    page
      .locator("[data-transport-attributions]")
      .getByRole("link", { name: "Licence", exact: true }),
  ).toHaveCount(2);
});

for (const [name, status, data] of [
  ["empty", 200, []],
  ["unavailable", 503, null],
] as const) {
  test(`footer does not invent attribution when the backend is ${name}`, async ({
    page,
  }) => {
    const response = page.waitForResponse("**/api/transport/attributions/");
    await page.route("**/api/transport/attributions/", async (route) =>
      route.fulfill({
        status,
        json: { success: status === 200, data },
      }),
    );
    await page.goto("/");
    await response;
    await expect(page.locator("[data-transport-attributions]")).toHaveCount(0);
  });
}
