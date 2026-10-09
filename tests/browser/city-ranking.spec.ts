import { test, expect } from "@playwright/test";

test("cities preserve Java priority, refine once by private GPS and never refetch on focus", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  const requests: string[] = [];
  await page.route("**/api/transport/cities/**", async (route) => {
    const request = route.request();
    requests.push(request.method());
    if (request.method() === "POST") {
      expect(new URL(request.url()).search).toBe("");
      expect(request.postDataJSON().q.latitude).toBe(49.2);
    }
    const names =
      request.method() === "POST"
        ? ["Brno", "Praha", "A small town"]
        : ["Praha", "Brno", "A small town"];
    await route.fulfill({
      json: {
        success: true,
        data: names.map((name) => ({
          id: name,
          name,
          state: "CZ",
          sourceMode: "index",
        })),
      },
    });
  });
  await page.goto("/?country=CZ");
  await page.locator("#travel-city").click();
  await expect.poll(() => requests.includes("POST")).toBe(true);
  await expect(
    page.locator("#city-options [role=option]").nth(1),
  ).toHaveAttribute("aria-label", "Brno");
  await expect(
    page.locator("#city-options [role=option]").nth(2),
  ).toHaveAttribute("aria-label", "Praha");
  await page.locator("#travel-city").fill("Pra");
  await expect(
    page.locator("#city-options [role=option]").nth(1),
  ).toHaveAttribute("aria-label", "Praha");
  await page.locator("#place-to").click();
  await page.locator("#travel-city").click();
  expect(requests.filter((method) => method === "GET")).toHaveLength(1);
  expect(requests.filter((method) => method === "POST")).toHaveLength(1);
});
