import { test, expect } from "@playwright/test";

test("unavailable realtime advances the timetable dot without claiming an on-time train", async ({
  page,
}) => {
  const id = (value: string) =>
    Buffer.from(JSON.stringify(["tram", "pid", "stop", value, null])).toString(
      "base64url",
    );
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.route("**/api/transport/observation/**", (route) =>
    route.fulfill({ json: { success: true, data: { status: "unavailable" } } }),
  );
  await page.route("**/api/transport/tracking/**", (route) =>
    route.fulfill({ json: { success: true, data: { status: "unsupported" } } }),
  );
  await page.route("**/api/transport/trip/**", async (route) => {
    const json = await (await route.fetch()).json();
    json.data.stops = json.data.stops
      .slice(0, 3)
      .map((call: Record<string, unknown>, i: number) => ({
        ...call,
        arrival: new Date(now + (i * 10 - 5) * 60000).toISOString(),
        departure: new Date(now + (i * 10 - 5) * 60000).toISOString(),
      }));
    await route.fulfill({ json });
  });
  await page.goto(
    "/spojeni/?" +
      new URLSearchParams({
        fromKind: "stop",
        from: id("S1"),
        fromLabel: "Praha, Muzeum",
        toKind: "stop",
        to: id("S2"),
        toLabel: "Praha, Malostranská",
        at: "2026-10-06T08:00:00Z",
        country: "CZ",
      }),
  );
  await page.locator("[data-summary-trip]").first().click();
  const dialog = page.locator("[data-trip-dialog]");
  const dot = dialog.locator("[data-trip-vehicle-dot]");
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute("data-estimated", "true");
  await expect(dot).toHaveAttribute("data-from", "0");
  await expect(dot).toHaveAttribute("data-to", "1");
  await expect(dot).toHaveAttribute("aria-label", /Odhad podle jízdního řádu/);
  const before = Number(await dot.getAttribute("data-fraction"));
  const rows = await dialog.locator(".trip-call time").allTextContents();
  await page.clock.runFor(3000);
  await expect
    .poll(async () => Number(await dot.getAttribute("data-fraction")))
    .toBeGreaterThan(before);
  expect(await dialog.locator(".trip-call time").allTextContents()).toEqual(
    rows,
  );
  await expect(dialog.locator("[data-delay-status]")).toHaveCount(0);
  await expect(dialog).not.toContainText("Bez zpoždění");
});
