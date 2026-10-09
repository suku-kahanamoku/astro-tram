import { test, expect } from "@playwright/test";

const stopId = (id: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", id, null])).toString(
    "base64url",
  );
const params = new URLSearchParams({
  fromKind: "stop",
  from: stopId("S1"),
  fromLabel: "Praha, Muzeum",
  toKind: "stop",
  to: stopId("S2"),
  toLabel: "Praha, Malostranská",
  at: "2026-10-06T08:00:00Z",
  country: "CZ",
});
const path = "/spojeni/?" + params + "#results";
const toastSelector = "[data-sonner-toast]";

for (const width of [320, 1280]) {
  test(`copy confirmation replaces previous toast, keeps the button label and fits at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.documentElement.dataset.copiedUrl = value;
          },
        },
      });
    });
    await page.goto(path);
    await expect(page.locator(".journey-card")).toHaveCount(2);
    await expect(page.locator(toastSelector)).toHaveCount(0);
    const copy = page.locator("[data-share]");
    for (let i = 0; i < 3; i++) {
      await copy.click();
      await expect(page.locator(toastSelector)).toHaveCount(1);
      await expect(page.locator(toastSelector)).toContainText(
        "Odkaz zkopírován do schránky.",
      );
    }
    await expect(copy).toHaveAccessibleName("Zkopírovat odkaz");
    await expect(copy).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.dataset.copiedUrl),
    ).toBe(page.url());
    const notice = page.locator(toastSelector);
    await expect(notice).toHaveAttribute("data-type", "success");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((mode) => {
        document.documentElement.dataset.theme = "tram";
        document.documentElement.dataset.themeMode = mode;
      }, theme);
      const bounds = (await notice.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    }
    await page.screenshot({ path: testInfo.outputPath("copy-toast.png") });
    await notice.getByRole("button", { name: "Zavřít oznámení" }).click();
    await expect(page.locator(toastSelector)).toHaveCount(0);
    await copy.click();
    await expect(page.locator(toastSelector)).toContainText(
      "Odkaz zkopírován do schránky.",
    );
  });
}

for (const [route, message, close] of [
  ["/en/journeys/", "Link copied to clipboard.", "Dismiss notification"],
  [
    "/de/verbindungen/",
    "Link in die Zwischenablage kopiert.",
    "Benachrichtigung schließen",
  ],
]) {
  test(`copy toast is localized at ${route}`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async () => {} },
      });
    });
    await page.goto(route + "?" + params);
    await expect(page.locator(".journey-card")).toHaveCount(2);
    await page.locator("[data-share]").click();
    await expect(page.locator(toastSelector)).toContainText(message);
    await expect(
      page.locator(toastSelector).getByRole("button", { name: close }),
    ).toBeVisible();
  });
}

test("missing clipboard shows one actionable error without changing the copy button", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await page.goto(path);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await page.locator("[data-share]").click();
  const notice = page.locator(toastSelector);
  await expect(notice).toHaveAttribute("data-type", "error");
  await expect(notice).toContainText("Odkaz se nepodařilo zkopírovat.");
  await expect(notice).toContainText("Zkopíruj ho prosím z adresního řádku.");
  await expect(page.locator("[data-share]")).toHaveAccessibleName(
    "Zkopírovat odkaz",
  );
});

test("empty search produces one toast after completion and keeps its guidance on the page", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/transport/search/**", async (route) => {
    const json = await (await route.fetch()).json();
    json.data.journeys = [];
    await pending;
    await route.fulfill({ json });
  });
  try {
    await page.goto(path);
    await expect(page.locator("[data-results-content] .spinner")).toBeVisible();
    await expect(page.locator(toastSelector)).toHaveCount(0);
    release();
    const notice = page.locator(toastSelector);
    await expect(notice).toContainText("Pro toto zadání jsme nenašli spojení.");
    await expect(notice).toHaveAttribute("data-type", "info");
    await notice.getByRole("button", { name: "Zavřít oznámení" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.locator("[data-results-content]")).toContainText(
      "Zkus jiný čas, povol přestupy nebo změň zastávky.",
    );
    await page.evaluate(() => {
      const url = new URL(location.href);
      url.searchParams.set("map", "closed");
      history.pushState(null, "", url);
      dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(notice).toHaveCount(0);
  } finally {
    release();
  }
});

test("failed search toast expires, leaves retry available and successful retry stays quiet", async ({
  page,
}) => {
  await page.clock.install();
  let fail = true;
  await page.route("**/api/transport/search/**", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { success: false, error: "unavailable" },
        })
      : route.continue(),
  );
  await page.goto(path);
  const notice = page.locator(toastSelector);
  await expect(notice).toContainText("Spojení teď nemůžeme načíst.");
  await expect(notice).toContainText("Zkus to prosím později.");
  await page.clock.fastForward(7000);
  await expect(notice).toHaveCount(0);
  await expect(page.locator("[data-retry]")).toBeVisible();
  await page.locator("[data-retry]").click();
  await expect(notice).toContainText("Spojení teď nemůžeme načíst.");
  await expect(notice).toHaveCount(1);
  await notice.getByRole("button", { name: "Zavřít oznámení" }).click();
  await expect(notice).toHaveCount(0);
  fail = false;
  await page.locator("[data-retry]").click();
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(notice).toHaveCount(0);
  await page.locator(".journey-summary-toggle").first().click();
  await expect(page.locator("[data-delay-status]").first()).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test("a search prompt and automatic GPS ranking stay quiet; explicit GPS failure notifies", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_ok: unknown, fail: (error: unknown) => void) =>
          fail({ code: 1 }),
      },
    });
  });
  await page.goto("/spojeni/");
  await expect(page.locator("[data-results-content]")).toContainText(
    "Vyplň odkud a kam a vyber čas cesty.",
  );
  await expect(page.locator(toastSelector)).toHaveCount(0);
  await page.locator("#country-cz").click();
  await page.locator("#travel-city").click();
  await expect(
    page.locator("#city-options [role=option]").first(),
  ).toBeVisible();
  await expect(page.locator(toastSelector)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator('[data-location="from"]').click();
  await expect(page.locator(toastSelector)).toHaveAttribute(
    "data-type",
    "error",
  );
  await expect(page.locator(toastSelector)).toContainText(
    "Zadej místo ručně nebo vyber zastávku z nabídky.",
  );
});

test("a fast outcome is retained while the separate toast island is still loading", async ({
  page,
}) => {
  let release!: () => void;
  let held = false;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/ToastViewport\.tsx(?:\?|$)/, async (route) => {
    held = true;
    await pending;
    await route.continue();
  });
  await page.route("**/api/transport/search/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  try {
    await page.goto(path);
    await expect(page.locator("[data-retry]")).toBeVisible();
    expect(held).toBe(true);
    await expect(page.locator(toastSelector)).toHaveCount(0);
    release();
    await expect(page.locator(toastSelector)).toContainText(
      "Spojení teď nemůžeme načíst.",
    );
    await expect(page.locator(toastSelector)).toHaveCount(1);
  } finally {
    release();
  }
});

test("successful retry cancels an old message before the toast island hydrates", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/ToastViewport\.tsx(?:\?|$)/, async (route) => {
    await pending;
    await route.continue();
  });
  let fail = true;
  await page.route("**/api/transport/search/**", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { success: false, error: "unavailable" },
        })
      : route.continue(),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => {} },
    });
  });
  try {
    await page.goto(path);
    await expect(page.locator("[data-retry]")).toBeVisible();
    fail = false;
    await page.locator("[data-retry]").click();
    await expect(page.locator(".journey-card")).toHaveCount(2);
    release();
    await expect(
      page.locator('astro-island[component-url*="ToastViewport"][ssr]'),
    ).toHaveCount(0);
    await expect(page.locator(toastSelector)).toHaveCount(0);
    await page.locator("[data-share]").click();
    await expect(page.locator(toastSelector)).toContainText(
      "Odkaz zkopírován do schránky.",
    );
  } finally {
    release();
  }
});
