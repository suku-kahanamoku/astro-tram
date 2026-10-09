import { test, expect } from "@playwright/test";

const id = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const query = (from = id("S1"), at = "2026-10-06T08:00:00Z") =>
  new URLSearchParams({
    fromKind: "stop",
    from,
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: id("S2"),
    toLabel: "Praha, Malostranská",
    at,
    country: "CZ",
  }).toString();

for (const scenario of ["fast", "night"]) {
  test(`ten journey pages forward, backward and after refresh (${scenario})`, async ({
    page,
  }) => {
    await page.goto(
      `/spojeni/?${query(`pagination_${scenario}`, "2026-10-05T22:00:00Z")}`,
    );
    const cards = page.locator("[data-journey]");
    await expect(cards).toHaveCount(10);
    const first = await cards.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-journey")),
    );
    await page.locator('[data-pagination-position="top"] [data-later]').click();
    await expect(cards).toHaveCount(10);
    await expect(page).toHaveURL(/page=later/);
    const second = await cards.evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-journey")),
    );
    expect(second.some((key) => first.includes(key))).toBe(false);
    await page.reload();
    await expect(cards).toHaveCount(10);
    expect(
      await cards.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-journey")),
      ),
    ).toEqual(second);
    await page
      .locator('[data-pagination-position="top"] [data-earlier]')
      .click();
    await expect(cards).toHaveCount(10);
    expect(
      await cards.evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("data-journey")),
      ),
    ).toEqual(first);
    // A fresh form submission must use the chosen radio, not the page's backward direction.
    const request = page.waitForRequest(
      (request) =>
        request.url().includes("/api/transport/search/") &&
        request.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Hledat spojení", exact: true })
      .click();
    expect((await request).postDataJSON()["from-date"]).toBeDefined();
    await expect(page).not.toHaveURL(/page=/);
  });
}

for (const width of [390, 1280]) {
  test(`vertical languages, footer columns and aligned timeline spacing (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const params = new URLSearchParams(query());
    params.set("to", id("S3"));
    params.set("toLabel", "Praha, Národní třída");
    await page.goto(`/spojeni/?${params}`);
    await expect(page.locator(".journey-card")).toHaveCount(2);
    await page.locator(".language-picker summary").click();
    const flags = await page.locator(".language-options a").all();
    const boxes = await Promise.all(flags.map((flag) => flag.boundingBox()));
    expect(boxes).toHaveLength(3);
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.x).toBeCloseTo(boxes[0]!.x, 0);
      expect(boxes[index]!.y).toBeGreaterThanOrEqual(
        boxes[index - 1]!.y + boxes[index - 1]!.height,
      );
    }
    await page.locator(".language-picker summary").click();
    const links = (await page.locator(".footer-links").boundingBox())!;
    const notes = (await page.locator(".footer-notes").boundingBox())!;
    expect(notes.x).toBeGreaterThanOrEqual(links.x + links.width);
    expect(Math.abs(notes.y - links.y)).toBeLessThan(1);
    await page.locator(".journey-summary").first().click();
    await page.locator(".intermediate-toggle").first().click();
    const intermediate = page
      .locator("[data-intermediate-stops] .trip-call")
      .first();
    await expect(intermediate).toBeVisible();
    const inlineGap = await intermediate.evaluate((row) => {
      const dot = row
        .querySelector(".trip-axis-point")!
        .getBoundingClientRect();
      return (
        row.querySelector("time")!.getBoundingClientRect().left -
        (dot.left + dot.width / 2)
      );
    });
    expect(inlineGap).toBeGreaterThanOrEqual(17);
    await page.locator("[data-trip-open]").first().click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog).toBeVisible();
    const dialogGap = await dialog
      .locator(".trip-call")
      .first()
      .evaluate((row) => {
        const dot = row
          .querySelector(".trip-axis-point")!
          .getBoundingClientRect();
        return (
          row.querySelector("time")!.getBoundingClientRect().left -
          (dot.left + dot.width / 2)
        );
      });
    expect(Math.abs(dialogGap - inlineGap)).toBeLessThan(2);
    await expect
      .poll(async () => {
        const title = (await dialog.locator("#trip-title").boundingBox())!;
        const close = (await dialog
          .locator("[data-close-trip]")
          .boundingBox())!;
        return close.x - (title.x + title.width);
      })
      .toBeLessThan(20);
    await expect(
      dialog.locator("[data-trip-vehicle-dot][data-outside]"),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
