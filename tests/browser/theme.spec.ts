import { test, expect, type Page } from "@playwright/test";

async function mount(page: Page) {
  await page.evaluate(async () => {
    const path = "/tests/react-harness.tsx";
    const harness = await import(/* @vite-ignore */ path);
    (window as any).unmountThemeHarness = harness.mountThemeHarness();
  });
  await expect(page.locator("#theme-test-harness .theme-toggle")).toHaveCount(
    2,
  );
}
async function expectMode(page: Page, mode: "light" | "dark") {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "tram");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", mode);
  for (const button of await page
    .locator("#theme-test-harness .theme-toggle")
    .all())
    await expect(button).toHaveAttribute(
      "aria-pressed",
      String(mode === "dark"),
    );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#fff8ee",
  );
}

test("theme controls share a mode, toggle in both directions and restore the persisted preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await mount(page);
  await expectMode(page, "light");
  const buttons = page.locator("#theme-test-harness .theme-toggle");
  for (const mode of ["dark", "light", "dark"] as const) {
    await buttons.first().click();
    await expectMode(page, mode);
    expect(await page.evaluate(() => localStorage.getItem("tram-theme"))).toBe(
      mode,
    );
  }
  await page.reload();
  await mount(page);
  await expectMode(page, "dark");
  await buttons.last().click();
  await expectMode(page, "light");
  await page.reload();
  await mount(page);
  await expectMode(page, "light");
});

test("theme follows system changes until explicitly selected; ambiguous legacy brand preferences follow the system", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("tram-theme", "tram"));
  await mount(page);
  await expectMode(page, "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectMode(page, "dark");
  await page.locator("#theme-test-harness .theme-toggle").first().click();
  await expectMode(page, "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expectMode(page, "light");
  // Restoring a page also passes through the same application function.
  await page.evaluate(() => {
    localStorage.setItem("tram-theme", "dark");
    window.dispatchEvent(new Event("pageshow"));
  });
  await expectMode(page, "dark");
});

test("theme preference updates and clearing storage synchronize across actual browser tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await mount(page);
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await other.goto("/");
  await mount(other);
  await page.locator("#theme-test-harness .theme-toggle").first().click();
  await expectMode(page, "dark");
  await expectMode(other, "dark");
  await other.locator("#theme-test-harness .theme-toggle").last().click();
  await expectMode(page, "light");
  await expectMode(other, "light");
  await page.locator("#theme-test-harness .theme-toggle").first().click();
  await expectMode(other, "dark");
  await page.evaluate(() =>
    localStorage.setItem("unrelated-test-key", "light"),
  );
  await expectMode(other, "dark");
  await page.evaluate(() => localStorage.clear());
  await expectMode(other, "light");
  await other.close();
});

test("theme remains usable and synchronizes mounted controls when browser storage is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage disabled", "SecurityError");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await mount(page);
  await expectMode(page, "light");
  await page.locator("#theme-test-harness .theme-toggle").first().click();
  await expectMode(page, "dark");
  await page.locator("#theme-test-harness .theme-toggle").last().click();
  await expectMode(page, "light");
  expect(errors).toEqual([]);
});

test("unmounting theme consumers removes storage, page, custom-event and system listeners", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await mount(page);
  await page.evaluate(() => {
    (window as any).unmountThemeHarness();
    document.documentElement.dataset.themeMode = "unmounted";
    window.dispatchEvent(
      new StorageEvent("storage", { key: "tram-theme", newValue: "dark" }),
    );
    window.dispatchEvent(new CustomEvent("tram:theme", { detail: "light" }));
    window.dispatchEvent(new Event("pageshow"));
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-theme-mode",
    "unmounted",
  );
  await mount(page);
  await expectMode(page, "dark");
});
