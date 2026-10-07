import { test, expect, type Page } from "@playwright/test";

const countries = ["CZ", "SK", "AT", "PL", "DE"];
async function coverage(page: Page) {
  await page.route("**/api/transport/coverage/**", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: countries.map((state) => ({
          state,
          searchAvailable: true,
          citiesAvailable: true,
          capabilities: ["places", "cities", "journeys"],
        })),
      },
    }),
  );
}
const q = (request: import("@playwright/test").Request) =>
  request.method() === "POST"
    ? request.postDataJSON().q
    : JSON.parse(new URL(request.url()).searchParams.get("q") ?? "{}");

test("World is first, hides the city field and searches every advertised country without a city filter", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  await coverage(page);
  const queries: Record<string, unknown>[] = [];
  let cityRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/transport/cities/")) cityRequests++;
  });
  await page.route("**/api/transport/places/**", (route) => {
    const query = q(route.request());
    queries.push(query);
    return route.fulfill({
      json: {
        success: true,
        data:
          query.state === "DE"
            ? [
                {
                  id: "de_stop",
                  name: "Berlin, Alexanderplatz",
                  state: "DE",
                  kind: "stop",
                  lat: 52.52,
                  lon: 13.41,
                  sourceMode: "index",
                },
              ]
            : [],
      },
    });
  });
  await page.goto("/?scope=world&city=Brno");
  await expect(page.getByRole("tab").first()).toHaveAccessibleName("Svět");
  await expect(
    page.getByRole("tab", { name: "Svět", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#travel-city")).toHaveCount(0);
  await page.locator("#place-to").fill("Alex");
  await expect(
    page.getByRole("option", { name: "Berlin, Alexanderplatz", exact: true }),
  ).toBeVisible();
  expect(queries.map((query) => query.state).sort()).toEqual(
    [...countries].sort(),
  );
  expect(
    queries.every(
      (query) => query.city === undefined && query.latitude === 49.2,
    ),
  ).toBe(true);
  expect(cityRequests).toBe(0);
  await page.locator("#country-cz").click();
  await expect(page.locator("#travel-city")).toBeVisible();
  await page.locator("#country-cz").press("Home");
  await expect(page.locator("#country-world")).toBeFocused();
  await expect(page.locator("#travel-city")).toHaveCount(0);
});

test("every national tab strictly scopes cities, stops and streets even when GPS is abroad", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2, longitude: 16.6 });
  await coverage(page);
  const queries: Record<string, unknown>[] = [];
  await page.route("**/api/transport/cities/**", (route) => {
    const country = q(route.request()).state;
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: `${country}_city`,
            name: `City ${country}`,
            state: country,
            sourceMode: "index",
          },
          {
            id: "foreign_city",
            name: "Foreign city",
            state: country === "DE" ? "CZ" : "DE",
            sourceMode: "index",
          },
        ],
      },
    });
  });
  await page.route("**/api/transport/places/**", (route) => {
    const query = q(route.request());
    queries.push(query);
    return route.fulfill({
      json: {
        success: true,
        data: [
          {
            id: `${query.state}_stop`,
            name: `Stop ${query.state}`,
            state: query.state,
            kind: "stop",
            sourceMode: "index",
          },
          {
            id: `${query.state}_street`,
            name: `Street ${query.state}`,
            state: query.state,
            kind: "street",
            lat: 50,
            lon: 14,
            sourceMode: "index",
          },
          {
            id: "foreign_stop",
            name: "Foreign stop",
            state: query.state === "DE" ? "CZ" : "DE",
            kind: "stop",
            sourceMode: "index",
          },
        ],
      },
    });
  });
  await page.goto("/");
  for (const country of countries) {
    await page.locator(`#country-${country.toLowerCase()}`).click();
    await page.locator("#travel-city").focus();
    await expect(
      page.getByRole("option", { name: `City ${country}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Foreign city", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("option", { name: `City ${country}`, exact: true })
      .click();
    for (const side of ["from", "to"]) {
      await page.locator(`#place-${side}`).fill("test");
      await expect(
        page.getByRole("option", { name: `Stop ${country}`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: `Street ${country}`, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Foreign stop", exact: true }),
      ).toHaveCount(0);
      expect(queries.at(-1)?.state).toBe(country);
      expect(queries.at(-1)?.city).toBe(`City ${country}`);
      expect(queries.at(-1)?.latitude).toBe(49.2);
      await page
        .getByRole("option", { name: `Stop ${country}`, exact: true })
        .click();
    }
  }
});

test("World routes selected German endpoints to Germany and survives search and reload without adding a city", async ({
  page,
}) => {
  await coverage(page);
  // The shared fixture deliberately rejects DE; reuse its synthetic timetable
  // while asserting the browser's original German request below.
  await page.route("**/api/transport/search/**", async (route) => {
    const body = route.request().postDataJSON();
    const response = await route.fetch({
      postData: JSON.stringify({ ...body, state: "CZ" }),
    });
    await route.fulfill({ response });
  });
  await page.route("**/api/transport/places/**", (route) => {
    const query = q(route.request());
    const origin = query.name?.$regex?.includes("Alex");
    return route.fulfill({
      json: {
        success: true,
        data:
          query.state === "DE"
            ? [
                {
                  id: origin ? "de_from" : "de_to",
                  name: origin
                    ? "Berlin, Alexanderplatz"
                    : "Berlin, Hauptbahnhof",
                  state: "DE",
                  kind: "stop",
                  sourceMode: "index",
                },
              ]
            : [],
      },
    });
  });
  await page.goto("/?scope=world");
  for (const [side, text, name] of [
    ["from", "Alex", "Berlin, Alexanderplatz"],
    ["to", "Haupt", "Berlin, Hauptbahnhof"],
  ]) {
    await page.locator(`#place-${side}`).fill(text);
    await page.getByRole("option", { name, exact: true }).click();
  }
  const submission = page.waitForRequest((r) =>
    r.url().includes("/api/transport/search/"),
  );
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  const body = (await submission).postDataJSON();
  expect(body.state).toBe("DE");
  expect(body.city).toBeUndefined();
  await expect(page.locator(".journey-card").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("scope")).toBe("world");
  expect(new URL(page.url()).searchParams.has("city")).toBe(false);
  await page.reload();
  await expect(page.locator("#country-world")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator("#travel-city")).toHaveCount(0);
  await expect(page.locator("#place-from")).toHaveValue(
    "Berlin, Alexanderplatz",
  );
});
