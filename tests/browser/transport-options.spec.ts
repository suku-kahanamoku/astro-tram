import { test, expect, type Locator } from "@playwright/test";

const id = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const palette = (element: Locator) =>
  element.evaluate((el) => {
    const css = getComputedStyle(el);
    return {
      foreground: css.color,
      background: css.backgroundColor,
      path: el.querySelector("path")?.getAttribute("d"),
    };
  });

test("empty fields open options without GPS, support Escape and reopen by click", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).gpsCalls = 0;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition(_ok: unknown, error: (value: unknown) => void) {
          (window as any).gpsCalls++;
          error({ code: 1 });
        },
      },
    });
  });
  await page.goto("/");
  const input = page.locator("#place-from");
  await expect(input).toBeEnabled();
  await input.click();
  await expect(page.locator("#suggestions-from")).toBeVisible();
  await expect(input).toHaveAttribute("aria-expanded", "true");
  expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await input.click();
  await expect(
    page.getByRole("option", { name: "Moje aktuální poloha", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    "suggestions-from-0",
  );
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => (window as any).gpsCalls)).toBe(1);
  await expect(page.locator("[data-form-error]")).toContainText(
    "Polohu se nepodařilo získat",
  );
});

test("options share symbols and colors with journey summary, detail and trip dialog", async ({
  page,
}) => {
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: id("S1"),
            name: "Praha, Muzeum",
            state: "CZ",
            city: "Praha",
            modes: ["tram", "bus", "trolleybus"],
            transportScope: "urban",
            sourceMode: "otp",
          },
          {
            id: id("S2"),
            name: "Praha, Malostranská",
            state: "CZ",
            city: "Praha",
            modes: ["train"],
            sourceMode: "otp",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.locator("#place-from").fill("Praha");
  const option = page.getByRole("option", {
    name: "Praha, Muzeum",
    exact: true,
  });
  await expect(option).toBeVisible();
  await expect(option.locator("small")).toHaveText(
    "Zastávka · Česká republika · Praha · MHD · Tramvaj · Autobus · Trolejbus",
  );
  await expect(option.locator(".transport-mode-symbol")).toHaveCount(3);
  const tram = await palette(
    option.locator('.transport-mode-symbol[data-mode="tram"]'),
  );
  const bus = await palette(
    option.locator('.transport-mode-symbol[data-mode="bus"]'),
  );
  expect(tram.background).not.toBe(bus.background);
  expect(tram.path).not.toBe(bus.path);
  const iconBox = await option.locator(".place-option-symbols").boundingBox();
  const textBox = await option.locator(".combo-option-text").boundingBox();
  expect(textBox!.x).toBeGreaterThan(iconBox!.x + iconBox!.width);
  await page
    .locator("#suggestions-from")
    .screenshot({ path: "test-results/transport-options-desktop.png" });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator("#place-from")).toHaveValue("Praha, Muzeum");
  await page.locator("#place-to").fill("Malo");
  await page
    .getByRole("option", { name: "Praha, Malostranská", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  const card = page.locator(".journey-card").first();
  const summary = card
    .locator('.summary-badges .route-badge[data-mode="tram"]')
    .first();
  await expect(summary).toBeVisible();
  expect(await palette(summary)).toEqual(tram);
  await card.locator(".journey-summary-toggle").click();
  const detail = card
    .locator('.leg-title .route-badge[data-mode="tram"]')
    .first();
  await expect(detail).toBeVisible();
  expect(await palette(detail)).toEqual(tram);
  await summary.click();
  const dialogBadge = page.locator("[data-trip-dialog] .trip-title-service");
  await expect(dialogBadge).toBeVisible();
  expect(await palette(dialogBadge)).toEqual(tram);
  await page.screenshot({ path: "test-results/transport-shared-badge.png" });
});

test("mobile options keep missing metadata neutral and describe every supplied mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: "old",
            name: "Zastávka s dlouhým názvem bez dopravních metadat",
            city: "Praha",
            sourceMode: "otp",
          },
          {
            id: "multi",
            name: "Hlavní nádraží",
            state: "CZ",
            city: "Praha",
            modes: ["train", "metro", "tram", "bus", "ferry"],
            sourceMode: "otp",
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page.locator("#place-from").fill("nádraží");
  const options = page.locator("#suggestions-from [role=option]");
  await expect(options).toHaveCount(2);
  await expect(options.first()).toBeInViewport();
  await expect(options.nth(1)).toBeInViewport();
  await expect
    .poll(async () => {
      const bounds = await page.locator("#suggestions-from").boundingBox();
      return bounds ? bounds.y + bounds.height : Infinity;
    })
    .toBeLessThanOrEqual(812);
  await expect(
    options.first().locator('.transport-mode-symbol[data-mode="stop"]'),
  ).toBeVisible();
  await expect(options.first()).not.toContainText("MHD");
  await expect(options.nth(1).locator(".transport-mode-symbol")).toHaveCount(3);
  await expect(
    options.nth(1).locator(".place-option-symbols > small"),
  ).toHaveText("+2");
  await expect(
    options.nth(1).locator(".combo-option-text small"),
  ).toContainText("Vlak · Metro · Tramvaj · Autobus · Loď");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "test-results/transport-options-mobile.png" });
});

test("city options show localized country and city symbols in German", async ({
  page,
}) => {
  await page.goto("/de/");
  await page.locator("#travel-city").click();
  const option = page
    .locator("#city-options")
    .getByRole("option", { name: "Praha", exact: true });
  await expect(
    option.locator('.transport-mode-symbol[data-mode="city"]'),
  ).toBeVisible();
  await expect(option.locator("small")).toContainText("Stadt");
  await expect(option.locator("small")).toContainText("Tschech");
});
