import { test, expect } from "@playwright/test";

const id = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const selected = () =>
  new URLSearchParams({
    country: "CZ",
    from: id("S1"),
    fromLabel: "Praha, Muzeum",
    fromKind: "stop",
    to: id("S2"),
    toLabel: "Praha, Malostranská",
    toKind: "stop",
    dayMode: "today",
    timeMode: "now",
  });

test("from defaults to current location and both places are required", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#place-from")).toHaveValue("Moje aktuální poloha");
  for (const side of ["from", "to"])
    await expect(page.locator(`#place-${side}`)).toHaveAttribute(
      "required",
      "",
    );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  await expect(page.locator("#place-to")).toBeFocused();
  await expect(page).not.toHaveURL(/\/spojeni/);
});

test("plain destination resolves without choosing a suggestion and submits current location", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  await page.goto("/?country=CZ");
  await page.locator("#place-to").fill("grohova");
  await expect(
    page.getByRole("option", { name: "Brno, Grohova", exact: true }),
  ).toBeVisible();
  const submitted = page.waitForRequest((r) =>
    r.url().includes("/api/transport/search/"),
  );
  await page.locator("#place-to").press("Enter");
  const body = (await submitted).postDataJSON();
  expect(body["from-dest"].type).toBe("current_location");
  expect(body["to-dest"].id).toBe(id("S4"));
  expect(Math.abs(Date.now() - Date.parse(body["from-date"]))).toBeLessThan(
    5000,
  );
  await expect(page.locator("#place-to")).toHaveValue("Brno, Grohova");
  expect(page.url()).not.toMatch(/latitude|longitude|observed_at|49\.2|16\.6/);
});

test("automatic clock is sampled at every submit, explicit time is preserved", async ({
  page,
}) => {
  const now = new Date();
  now.setSeconds(23, 0);
  await page.clock.setFixedTime(now);
  await page.goto("/?" + selected());
  await expect(page.locator("#travel-time")).toBeVisible();
  const next = new Date(now.getTime() + 3 * 60000);
  await page.clock.setFixedTime(next);
  let submitted = page.waitForRequest((r) =>
    r.url().includes("/api/transport/search/"),
  );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  expect((await submitted).postDataJSON()["from-date"]).toBe(
    next.toISOString().replace(".000Z", "Z"),
  );
  await expect(page.locator(".journey-card").first()).toBeVisible();
  await page.locator("#travel-time").fill("08:45");
  await page.locator("#travel-time").press("Tab");
  submitted = page.waitForRequest((r) =>
    r.url().includes("/api/transport/search/"),
  );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  const at = new Date((await submitted).postDataJSON()["from-date"]);
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);
  expect(local).toBe("08:45");
  await expect(page).not.toHaveURL(/timeMode=now/);
  await expect(page).toHaveURL(/dayMode=today/);
});

test("opening the map keeps an automatic-clock search snapshot and does not search again", async ({
  page,
}) => {
  const params = selected();
  const instant = new Date();
  const snapshot = instant.toISOString().replace(/\.\d{3}Z$/, "Z");
  params.set("at", snapshot);
  let searches = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/transport/search/")) searches++;
  });
  await page.goto("/spojeni/?" + params);
  await expect(page.locator(".journey-card").first()).toBeVisible();
  const before = searches;
  await page.clock.setFixedTime(new Date(instant.getTime() + 3 * 60000));
  await page.locator('[data-map="from"]').click();
  await expect(page.locator("[data-map-dialog]")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("at")).toBe(snapshot);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-map-dialog]")).not.toBeVisible();
  expect(searches).toBe(before);
});

test("GPS scope is automatic only when no area has been explicitly selected", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  await page.goto("/");
  let pending = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
  );
  await page.locator("#place-to").fill("grohova");
  const automatic = (await pending).postDataJSON().q;
  expect(automatic.state).toBeUndefined();
  expect(automatic.city).toBeUndefined();
  expect(automatic.latitude).toBe(49.2);
  await page.locator("#travel-city").click();
  await page
    .locator("#city-options")
    .getByRole("option", { name: "Brno", exact: true })
    .click();
  pending = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
  );
  await page.locator("#place-to").fill("grohova");
  const explicit = (await pending).postDataJSON().q;
  expect(explicit.state).toBe("CZ");
  expect(explicit.city).toBe("Brno");
  expect(explicit.latitude).toBe(49.2);
});

test("localized React calendars fit mobile, close outside, and allow manual date entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?" + selected());
  await page.locator("#travel-day").click();
  await expect(page.locator(".ui-date-time-calendar")).toBeVisible();
  await expect
    .poll(async () => {
      const box = await page.locator(".ui-date-time-calendar").boundingBox();
      return !!box && box.x >= 0 && box.x + box.width <= 390;
    })
    .toBe(true);
  await page.locator("#travel-day").fill("2026-11-05");
  await page.locator("#travel-day").press("Tab");
  await page.locator("#travel-time").fill("10:35");
  await page.locator("#travel-time").press("Tab");
  const pending = page.waitForRequest((r) =>
    r.url().includes("/api/transport/search/"),
  );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  const at = new Date((await pending).postDataJSON()["from-date"]);
  expect(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Prague",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at),
  ).toBe("2026-11-05");
  await expect(page).not.toHaveURL(/dayMode=today|timeMode=now/);
});
