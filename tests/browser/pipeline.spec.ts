import { test, expect } from "@playwright/test";

test("only online planner policy is read on mount, never sync/build/deploy", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/admin/"))
      requests.push(new URL(r.url()).pathname);
  });
  await page.goto("/");
  const control = page.locator(".pipeline-controls");
  await expect(control.locator("button")).toHaveCount(1);
  await expect(control.locator("button")).toBeEnabled();
  await page.waitForTimeout(1200);
  expect(requests).toEqual(["/api/admin/online-planners/"]);
  await control.locator("button").click();
  await expect(control.locator('a[href="/prihlaseni/"]')).toBeVisible();
  expect(requests).toEqual(["/api/admin/online-planners/"]);
});

test("authenticated admin toggles online providers while transport stays independent", async ({
  page,
}) => {
  await page.goto("/prihlaseni/");
  await page.locator('input[name="email"]').fill("admin@example.test");
  await page.locator('input[name="password"]').fill("fixture-password");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("prihlaseni"));
  const button = page.locator(".pipeline-controls button");
  await expect(button).toBeEnabled();
  const before = await button.textContent();
  await button.click();
  await expect(button).not.toHaveText(before!);
  await button.click();
  await expect(button).toHaveText(before!);
});
