import { expect, test } from "@playwright/test";

test("licence page renders active backend sources, exact credits, update dates and external links", async ({
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
  await expect(
    page.locator("footer [data-transport-attributions]"),
  ).toHaveCount(0);
  await page.locator('footer a[href="/licence/"]').click();
  await expect(page).toHaveURL(/\/licence\/$/);
  const credits = page.locator(
    '[data-transport-attributions][aria-labelledby="transport-attributions-title"]',
  );
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
  await page.goto("/en/licenses/");
  await expect(credits.locator("h2")).toHaveText(
    "Transport and map data sources",
  );
  await expect(
    credits.getByRole("link", { name: "Licence", exact: true }),
  ).toHaveCount(2);
});

test("licence credits are present in server HTML without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const response = await page.goto("http://localhost:4328/licence/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Licence a zdroje",
    );
    await expect(
      page.locator('[data-attribution-source="fixture-timetable"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-attribution-source="realtime:idsjmk-traffic"]'),
    ).toContainText("NonCommercial");
    await expect(page.locator(".software-license-list")).toContainText(
      "OpenTripPlanner",
    );
    await expect(page.locator(".software-license-list")).not.toContainText(
      "Astro",
    );
    await expect(page.locator(".software-license-list")).not.toContainText(
      "React / React DOM",
    );
    await expect(
      page.locator('[data-attribution-source="gtfs:idsjmk:idsjmk"]'),
    ).toContainText("IDS JMK GTFS");
    const notice = await page.request.get("/licenses/openlayers.txt");
    expect(notice.status()).toBe(200);
    expect(await notice.text()).toContain("Copyright");
    expect(await response!.text()).not.toMatch(
      /DO_NOT_EXPOSE|private_token|api_key/,
    );
  } finally {
    await context.close();
  }
});

test("footer licence links are localized and other pages do not fetch the data list", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  for (const [home, link, title] of [
    ["/", "/licence/", "Licence a zdroje"],
    ["/en/", "/en/licenses/", "Licences and sources"],
    ["/de/", "/de/lizenzen/", "Lizenzen und Quellen"],
  ]) {
    await page.goto(home);
    await page.locator(`footer a[href="${link}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(
      page.locator('[data-attribution-source="fixture-timetable"]'),
    ).toBeVisible();
  }
  expect(
    requests.filter((url) => url.includes("/api/transport/attributions/")),
  ).toEqual([]);
});
