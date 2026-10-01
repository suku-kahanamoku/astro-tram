import { test, expect } from "@playwright/test";

test("React language disclosure closes on Escape/outside click and keeps localized URLs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const picker = page.locator(".language-picker");
  await expect(
    page.locator("[data-search-form] fieldset").first(),
  ).toBeEnabled();
  await picker.locator("summary").click();
  await expect(picker).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(picker).not.toHaveAttribute("open");
  await expect(picker.locator("summary")).toBeFocused();
  await picker.locator("summary").click();
  await page.locator("h1").click();
  await expect(picker).not.toHaveAttribute("open");
  await picker.locator("summary").click();
  await picker.locator("[hreflang=en]").click();
  await expect(page).toHaveURL(/\/en\//);
  expect(errors).toEqual([]);
});

test("React shared menu lifecycle and ads respect consent before loading third-party code", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let adRequests = 0;
  await page.route(
    "https://pagead2.googlesyndication.com/**",
    async (route) => {
      adRequests++;
      await route.fulfill({
        contentType: "application/javascript",
        body: "window.adsbygoogle = window.adsbygoogle || [];",
      });
    },
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const path = "/tests/react-harness.tsx";
    const harness = await import(/* @vite-ignore */ path);
    (window as any).unmountReactHarness = harness.mountHarness();
  });
  const harness = page.locator("#react-test-harness");
  await harness.getByRole("button", { name: "Open test menu" }).click();
  await expect(harness.locator(".mobile-nav")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(harness.locator(".mobile-nav")).toBeHidden();
  await expect(harness.locator("[data-menu-toggle]")).toBeFocused();
  await harness.getByRole("button", { name: "Toggle harness menu" }).click();
  await expect(harness.locator("[data-main-menu]")).toHaveCount(0);
  await harness.getByRole("button", { name: "Toggle harness menu" }).click();
  await harness.getByRole("button", { name: "Open test menu" }).click();
  await expect(harness.locator(".mobile-nav")).toBeVisible();
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(harness.locator(".mobile-nav")).toBeHidden();
  await expect(harness.locator(".theme-toggle")).toBeVisible();
  expect(adRequests).toBe(0);
  await harness.getByRole("button", { name: "Grant ad consent" }).click();
  await expect(harness.locator("ins.adsbygoogle")).toBeAttached();
  expect(adRequests).toBe(1);
  await page.evaluate(() => (window as any).unmountReactHarness());
  await expect(harness).toHaveCount(0);
});

test("React autocomplete ignores an older API response after a new query", async ({
  page,
}) => {
  await page.route("**/api/transport/places/**", async (route) => {
    const q = JSON.parse(
      new URL(route.request().url()).searchParams.get("q") || "{}",
    );
    const old = q.name?.$regex === "Old";
    if (old) await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: old ? "OLD" : "NEW",
            name: old ? "Old stop" : "New stop",
            lat: null,
            lon: null,
            sourceMode: "live",
          },
        ],
      },
    });
  });
  await page.goto("/");
  const input = page.locator("#place-from");
  await input.fill("Old");
  await page.waitForRequest((r) => r.url().includes("Old"));
  await input.fill("New");
  await expect(page.getByRole("option", { name: "New stop" })).toBeVisible();
  await page.waitForTimeout(650);
  await expect(page.getByRole("option", { name: "Old stop" })).toHaveCount(0);
  await page.getByRole("option", { name: "New stop" }).click();
  await expect(input).toHaveValue("New stop");
});
