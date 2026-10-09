import { test, expect } from "@playwright/test";

const stop = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const selected = new URLSearchParams({
  fromKind: "stop",
  from: stop("S1"),
  fromLabel: "Praha, Muzeum",
  toKind: "stop",
  to: stop("S2"),
  toLabel: "Praha, Malostranská",
  country: "CZ",
  at: "2026-10-06T08:00:00Z",
});

for (const width of [320, 480, 768]) {
  test(`service header and copy fit at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/spojeni/?" + selected);
    await expect(page.locator(".journey-card")).toHaveCount(2);
    const copy = page.locator("[data-share]");
    await expect
      .poll(async () => (await page.locator("#results").boundingBox())?.y)
      .toBeLessThan(25);
    await expect(copy).toBeVisible();
    await expect(copy.locator(".share-label"))[
      width <= 480 ? "toBeHidden" : "toBeVisible"
    ]();
    await page
      .locator(".journey-card")
      .first()
      .locator("[data-summary-trip]")
      .click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog.locator(".trip-call")).toHaveCount(3);
    await dialog.evaluate(async (element) => {
      await Promise.allSettled(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    const close = (await dialog.locator("[data-close-trip]").boundingBox())!;
    const service = (await dialog
      .locator(".trip-service-badge")
      .boundingBox())!;
    expect(
      service.x + service.width <= close.x ||
        service.y >= close.y + close.height,
    ).toBe(true);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`service-${width}.png`),
    });
  });
}

test.describe("touch search", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("choosing places and cities blurs input; scrolling keeps suggestions selectable", async ({
    page,
  }) => {
    await page.goto("/");
    const city = page.locator("#travel-city");
    await expect(city).toBeEnabled();
    await city.click();
    await page
      .locator("#city-options")
      .getByRole("option", { name: "Praha", exact: true })
      .click();
    await expect(city).not.toBeFocused();
    const field = page.locator("#place-to");
    await field.fill("Muzeum");
    const option = page
      .locator("#suggestions-to")
      .getByRole("option", { name: "Praha, Muzeum", exact: true });
    await expect(option).toBeVisible();
    await field.dispatchEvent("touchmove");
    await expect(field).not.toBeFocused();
    await expect(option).toBeVisible();
    await option.click();
    await expect(field).toHaveValue("Praha, Muzeum");
    await expect(field).not.toBeFocused();
    await field.click();
    await expect(option).toBeVisible();
    // The delayed scroll event also covers overflow containers without a touch gesture.
    await page.waitForTimeout(300);
    await page.locator("#suggestions-to").dispatchEvent("scroll");
    await expect(field).not.toBeFocused();
    await expect(option).toBeVisible();
    await field.click();
    await option.click();
    await expect(field).not.toBeFocused();
    await expect(page.locator("#suggestions-to")).toHaveCount(0);
    await field.click();
    await expect(option).toBeVisible();
    await field.dispatchEvent("touchmove");
    await page.locator(".section-heading").click();
    await expect(page.locator("#suggestions-to")).toHaveCount(0);
  });

  test("typed names navigate and scroll before their lookup and journey responses", async ({
    page,
  }) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const plannerPaths: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/transport/search/"))
        plannerPaths.push(new URL(page.url()).pathname);
    });
    await page.route("**/api/transport/places/**", async (route) => {
      const response = await route.fetch();
      await held;
      await route.fulfill({ response });
    });
    try {
      await page.goto("/?" + selected);
      await expect(page.locator("#place-to")).toBeEnabled();
      await page.locator("#place-to").fill("Malostranská");
      await page.locator("#place-to").press("Enter");
      await expect(page).toHaveURL(
        /\/spojeni\/\?.*toText=Malostransk.*#results$/,
      );
      await expect(page.locator("#results")).toBeInViewport();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expect(page.locator("#place-to")).not.toBeFocused();
      expect(plannerPaths).toEqual([]);
      release();
      await expect(page.locator(".journey-card")).toHaveCount(2);
      expect(plannerPaths).toEqual(["/spojeni/"]);
      const url = new URL(page.url());
      expect(url.searchParams.has("toText")).toBe(false);
      expect(url.searchParams.get("to")).toBe(stop("S2"));
      expect(url.hash).toBe("#results");
      const snapshot = page.url();
      await page
        .locator(".journey-card")
        .first()
        .locator(".journey-summary-toggle")
        .click();
      await page
        .locator(".journey-card")
        .first()
        .locator("[data-summary-trip]")
        .click();
      await expect(page.locator("[data-trip-dialog]")).toBeVisible();
      await page.locator("[data-close-trip]").click();
      await expect(page.locator("[data-trip-dialog]")).not.toBeVisible();
      expect(page.url()).toBe(snapshot);
    } finally {
      release();
    }
  });

  test("GPS is requested on results page and pending GPS does not delay the anchor", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).gpsPaths = [];
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition() {
            (window as any).gpsPaths.push(location.pathname);
          },
        },
      });
    });
    const params = new URLSearchParams(selected);
    params.delete("from");
    params.delete("fromLabel");
    params.set("fromKind", "current_location");
    await page.goto("/?" + params);
    await expect(page.locator(".search-submit")).toBeEnabled();
    await page.locator(".search-submit").click();
    await expect(page).toHaveURL(/\/spojeni\/.*#results$/);
    await expect(page.locator("#results")).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => (window as any).gpsPaths.length))
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(() =>
        (window as any).gpsPaths.every((path: string) => path === "/spojeni/"),
      ),
    ).toBe(true);
    await expect(page.locator(".status-card")).toContainText("polohu");
    await expect(page.locator(".journey-card")).toHaveCount(0);
  });

  test("copy remains beside heading, pages are above and below, badges wrap with arrows", async ({
    page,
  }, testInfo) => {
    await page.route("**/api/transport/search/**", async (route) => {
      const payload = await (await route.fetch()).json();
      const leg = payload.data.journeys[0].legs[0];
      payload.data.journeys[0].legs = [
        "walk",
        "tram",
        "walk",
        "train",
        "walk",
        "bus",
        "walk",
      ].map((mode, index) => ({
        ...leg,
        mode,
        line: ["", "4", "", "S2", "", "273", ""][index],
      }));
      await route.fulfill({ json: payload });
    });
    await page.goto("/spojeni/?" + selected);
    await expect(page.locator(".journey-card")).toHaveCount(2);
    const copy = page.locator("[data-share]");
    await expect(copy).toBeVisible();
    await expect(copy).toHaveAccessibleName("Zkopírovat odkaz");
    await expect(copy.locator(".share-label")).toBeHidden();
    const heading = (await page.locator(".results-heading h1").boundingBox())!;
    const button = (await copy.boundingBox())!;
    expect(button.x).toBeGreaterThan(heading.x + heading.width);
    expect(button.y).toBeLessThan(heading.y + heading.height);
    const top = page.locator('[data-pagination-position="top"]');
    await expect(top.locator("[data-earlier]")).toBeVisible();
    await expect(
      page.locator('[data-pagination-position="bottom"] [data-later]'),
    ).toBeVisible();
    expect((await top.boundingBox())!.y).toBeLessThan(
      (await page.locator(".journey-card").first().boundingBox())!.y,
    );
    const blocks = await page
      .locator(".journey-card")
      .first()
      .locator(".summary-leg-badges")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const badge = element
            .querySelector(".route-badge")!
            .getBoundingClientRect();
          const children = Array.from(element.children).map((child) =>
            child.getBoundingClientRect(),
          );
          return {
            y: badge.y,
            centers: children.map((rect) => rect.y + rect.height / 2),
          };
        }),
      );
    expect(new Set(blocks.map((block) => block.y)).size).toBeGreaterThan(1);
    for (const block of blocks)
      expect(
        Math.max(...block.centers) - Math.min(...block.centers),
      ).toBeLessThan(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath("mobile-results.png") });
  });

  test("shared service status has three lights and small delay in accordion and compact dialog", async ({
    page,
  }, testInfo) => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/transport/tracking/", (route) =>
      route.fulfill({ json: { success: true, data: { status: "disabled" } } }),
    );
    await page.route("**/api/transport/observation/**", async (route) => {
      await held;
      await route.fulfill({
        json: {
          success: true,
          data: { status: "unavailable", position: null, delay_seconds: null },
        },
      });
    });
    try {
      await page.goto("/spojeni/?" + selected);
      const card = page.locator(".journey-card").first();
      await card.locator(".journey-summary-toggle").click();
      const service = card.locator(".leg .trip-service-badge");
      await expect(service.locator(".vehicle-position-light")).toHaveCount(3);
      await expect(service.locator("[data-position-state]")).toHaveAttribute(
        "data-position-state",
        "connecting",
      );
      const delays = await service
        .locator(".vehicle-position-light")
        .evaluateAll((dots) =>
          dots.map((dot) => getComputedStyle(dot).animationDelay),
        );
      expect(delays).toEqual(["0s", "0.2s", "0.4s"]);
      release();
      await expect(service.locator("[data-position-state]")).toHaveAttribute(
        "data-position-state",
        "unavailable",
      );
      await expect(service.locator("[data-position-status]")).toHaveCSS(
        "position",
        "absolute",
      );
      await expect(service.locator("[data-delay-status]")).toHaveCSS(
        "font-size",
        "10px",
      );
      const identity = (await service.locator(".route-badge").boundingBox())!;
      const status = (await service
        .locator("[data-trip-observation-status]")
        .boundingBox())!;
      expect(status.x).toBeGreaterThan(identity.x + identity.width);
      await card.locator("[data-summary-trip]").click();
      const dialog = page.locator("[data-trip-dialog]");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator(".trip-service-badge .vehicle-position-light"),
      ).toHaveCount(3);
      await expect(dialog.locator(".eyebrow")).toHaveCount(0);
      await expect(dialog.locator("[data-delay-status]")).toHaveCSS(
        "font-size",
        "10px",
      );
      await dialog.evaluate(async (element) => {
        await Promise.allSettled(
          element.getAnimations().map((animation) => animation.finished),
        );
      });
      const close = (await dialog.locator("[data-close-trip]").boundingBox())!;
      const header = (await dialog
        .locator(".trip-sticky-header")
        .boundingBox())!;
      expect(close.width).toBe(44);
      expect(close.x + close.width).toBeGreaterThan(
        header.x + header.width - 30,
      );
      expect(close.y - header.y).toBeLessThan(30);
      await page.screenshot({
        path: testInfo.outputPath("mobile-service-dialog.png"),
      });
    } finally {
      release();
    }
  });
});
