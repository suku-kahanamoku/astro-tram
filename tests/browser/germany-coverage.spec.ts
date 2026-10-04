import { test, expect } from "@playwright/test";

test("Germany uses the configured backend coverage and German city scope", async ({
  page,
}) => {
  await page.route("**/api/transport/coverage/**", async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            state: "CZ",
            searchAvailable: true,
            citiesAvailable: true,
            capabilities: ["places", "journeys", "cities"],
          },
          {
            state: "DE",
            searchAvailable: true,
            citiesAvailable: true,
            capabilities: ["places", "journeys", "cities"],
          },
        ],
      },
    });
  });
  const states: string[] = [];
  await page.route("**/api/transport/cities/**", async (route) => {
    const url = new URL(route.request().url());
    const query =
      route.request().method() === "POST"
        ? route.request().postDataJSON()
        : JSON.parse(url.searchParams.get("q") ?? "{}");
    states.push(query.q?.state ?? query.state);
    await route.fulfill({
      json: {
        success: true,
        data: [
          { id: "berlin", name: "Berlin", state: "DE", sourceMode: "otp" },
        ],
        partial: false,
      },
    });
  });
  await page.goto("/");
  const germany = page.getByRole("tab", { name: "Německo" });
  await expect(germany).toBeEnabled();
  await germany.click();
  await expect(germany).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#country-search-de")).toBeVisible();
  await page.locator("#travel-city").focus();
  await expect(page.locator("#city-options")).toContainText("Berlin");
  expect(states).toContain("DE");
});

test("Germany stays unavailable until an actual backend graph is available", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Česká republika" }),
  ).toBeEnabled();
  await expect(page.getByRole("tab", { name: "Německo" })).toBeDisabled();
});
