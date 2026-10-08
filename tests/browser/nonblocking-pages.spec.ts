import { expect, test } from "@playwright/test";

for (const [path, heading] of [
  ["/", "Svět je blíž,"],
  ["/licence/", "Licence a zdroje"],
  ["/ucet/", "Váš účet"],
] as const) {
  test(`HTML for ${path} is visible while browser APIs are pending`, async ({
    page,
  }) => {
    let reads = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/**", async (route) => {
      reads++;
      await pending;
      await route.fulfill({
        status: 503,
        json: { success: false, error: "unavailable" },
      });
    });
    try {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toContainText(heading);
      await expect(page.locator("footer")).toBeVisible();
      await expect.poll(() => reads).toBeGreaterThan(0);
      if (path === "/licence/")
        await expect(
          page.locator("[data-attributions-status]"),
        ).toHaveAttribute("aria-busy", "true");
      if (path === "/ucet/") {
        await expect(page.locator(".auth-card")).toHaveAttribute(
          "aria-busy",
          "true",
        );
        expect(await response!.text()).not.toContain("admin@example.test");
      }
    } finally {
      release();
    }
    if (path === "/licence/")
      await expect(page.locator("[data-attributions-status]")).toContainText(
        "Seznam datových zdrojů se teď nepodařilo načíst.",
      );
    if (path === "/ucet/")
      await expect(page.locator(".auth-card")).toContainText(
        "Údaje účtu se nepodařilo načíst.",
      );
  });
}

test("account API authenticates after page load and logout remains a server form", async ({
  page,
}) => {
  await page.goto("/ucet/");
  await expect(page).toHaveURL(/\/prihlaseni\/$/);
  await page.locator('input[name="email"]').fill("admin@example.test");
  await page.locator('input[name="password"]').fill("fixture-password");
  await page.locator('.auth-form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/ucet\/$/);
  await expect(page.locator(".auth-card")).toContainText("admin@example.test");
  const response = await page.request.get("/ucet/");
  expect(await response.text()).not.toContain("admin@example.test");
  const me = await page.request.get("/api/auth/me/");
  expect(me.headers()["cache-control"]).toBe("private, no-store");
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page).toHaveURL(/\/prihlaseni\/$/);
  expect((await page.request.get("/api/auth/me/")).status()).toBe(401);
});

test("static login displays redirect errors from browser URL", async ({
  page,
}) => {
  await page.goto("/en/login/?error=invalid");
  await expect(page.getByRole("alert")).toContainText("email");
});

test("private page headers and HTTP alias redirects survive static rendering", async ({
  request,
}) => {
  for (const [path, referrer] of [
    ["/spojeni/", "no-referrer"],
    ["/prihlaseni/", "same-origin"],
    ["/ucet/", "same-origin"],
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["referrer-policy"]).toBe(referrer);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  }
  const alias = await request.get("/login/?error=invalid", { maxRedirects: 0 });
  expect(alias.status()).toBe(308);
  expect(alias.headers()["location"]).toBe("/prihlaseni/?error=invalid");
});

test("language switch keeps the current search query", async ({ page }) => {
  await page.goto("/spojeni/?country=DE&fromLabel=Berlin&toLabel=Hamburg");
  const picker = page.locator(".language-picker");
  await expect(picker.locator("summary")).toHaveAttribute(
    "aria-disabled",
    "false",
  );
  await picker.locator("summary").click();
  await picker.locator('[hreflang="en"]').click();
  await expect(page).toHaveURL(
    /\/en\/journeys\/\?country=DE&fromLabel=Berlin&toLabel=Hamburg$/,
  );
});
