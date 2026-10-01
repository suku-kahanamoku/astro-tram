import { test, expect } from "@playwright/test";

test("city dropdown loads the online catalogue and filters all municipalities without extra stop queries", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/transport/")) requests.push(r.url());
  });
  await page.goto("/");
  const field = page.locator("#travel-city");
  await field.click();
  const list = page.locator("#city-options");
  await expect(
    list.getByRole("option", { name: "Tábor", exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("option", { name: "Ostrava", exact: true }),
  ).toBeVisible();
  await expect(
    list.getByRole("option", { name: "Třebíč", exact: true }),
  ).toBeVisible();
  await field.fill("treb");
  await list.getByRole("option", { name: "Třebíč", exact: true }).click();
  await expect(field).toHaveValue("Třebíč");
  expect(requests.filter((r) => r.includes("/cities/"))).toHaveLength(1);
  expect(requests.filter((r) => r.includes("/places/"))).toHaveLength(0);
  const request = page.waitForRequest((r) => r.url().includes("/places/"));
  await page.locator("#place-from").fill("Nemocnice");
  const q = JSON.parse(new URL((await request).url()).searchParams.get("q")!);
  expect(q.city).toBe("Třebíč");
});

test("city catalogue preloads once and survives closing and reopening while in flight", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/transport/cities/**", async (route) => {
    requests++;
    await ready;
    await route.fulfill({
      json: {
        success: true,
        data: [{ id: "tabor", name: "Tábor", state: "CZ", sourceMode: "live" }],
      },
    });
  });
  const preload = page.waitForRequest((r) =>
    r.url().includes("/api/transport/cities/"),
  );
  await page.goto("/");
  await preload; // The request starts before the picker gets focus.
  const field = page.locator("#travel-city");
  try {
    await field.click();
    await page.locator("h1").first().click();
    await field.click();
    expect(requests).toBe(1);
  } finally {
    release();
  }
  const tabor = page
    .locator("#city-options")
    .getByRole("option", { name: "Tábor", exact: true });
  await expect(tabor).toBeVisible();
  await tabor.click();
  await field.click();
  await expect(tabor).toBeVisible();
  expect(requests).toBe(1);
  await page.reload();
  await field.click();
  await expect(tabor).toBeVisible();
  expect(requests).toBe(2); // A new page gets fresh online metadata.
});

test("long city catalogues render progressively and names beyond the first batch remain searchable", async ({
  page,
}) => {
  await page.route("**/api/transport/cities/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: Array.from({ length: 350 }, (_, i) => ({
          id: String(i),
          name: `Obec ${String(i).padStart(3, "0")}`,
          state: "CZ",
          sourceMode: "live",
        })),
      },
    }),
  );
  await page.goto("/");
  const field = page.locator("#travel-city");
  await field.click();
  const list = page.locator("#city-options");
  await expect(list.getByRole("option")).toHaveCount(100);
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(list.getByRole("option")).toHaveCount(200);
  await field.fill("Obec 349");
  await expect(list.getByRole("option")).toHaveCount(2);
  await field.press("ArrowDown");
  await field.press("ArrowDown");
  await field.press("Enter");
  await expect(field).toHaveValue("Obec 349");
});

test("city errors and empty catalogues keep all timetables usable and do not fabricate city choices", async ({
  page,
}) => {
  await page.route("**/api/transport/cities/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await page.goto("/");
  await page.locator("#travel-city").click();
  await expect(page.locator("[data-city-hint]")).toContainText(
    "Města se nepodařilo načíst",
  );
  await expect(page.locator("#city-options [role=option]")).toHaveCount(1);
  await page.locator("#city-options [role=option]").click();
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
  await page.route("**/api/transport/cities/**", (route) =>
    route.fulfill({ json: { success: true, data: [] } }),
  );
  const retry = page.waitForResponse(
    (r) => r.url().includes("/api/transport/cities/") && r.status() === 200,
  );
  await page.locator("#travel-city").click();
  await retry;
  await expect(page.locator("[data-city-hint]")).toContainText(
    "Město nenalezeno",
  );
  await expect(page.locator("#city-options [role=option]")).toHaveCount(1);
  const unexpectedRequest: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/cities/")) unexpectedRequest.push(r.url());
  });
  await page.locator("h1").first().click();
  await page.locator("#travel-city").click();
  await expect(page.locator("[data-city-hint]")).toContainText(
    "Město nenalezeno",
  );
  expect(unexpectedRequest).toHaveLength(0);
});

test("city BFF accepts only a country q and keeps the provider metadata private", async ({
  request,
}) => {
  const good = await request.get("/api/transport/cities/", {
    params: { q: JSON.stringify({ state: "CZ" }) },
  });
  expect(good.status()).toBe(200);
  expect(
    (await good.json()).data.map((c: { name: string }) => c.name),
  ).toContain("Tábor");
  for (const q of [
    { state: "CZE" },
    { state: "CZ", latitude: 50 },
    { state: "CZ", tenant: "other" },
  ]) {
    expect(
      (
        await request.get("/api/transport/cities/", {
          params: { q: JSON.stringify(q) },
        })
      ).status(),
    ).toBe(422);
  }
});
