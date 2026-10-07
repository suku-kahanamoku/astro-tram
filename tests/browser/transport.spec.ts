import { test, expect } from "@playwright/test";
const id = (external: string) =>
  Buffer.from(JSON.stringify(["tram", "pid", "stop", external, null])).toString(
    "base64url",
  );
const query = (extra: Record<string, string> = {}) =>
  new URLSearchParams({
    fromKind: "stop",
    from: id("S1"),
    fromLabel: "Praha, Muzeum",
    toKind: "stop",
    to: id("S2"),
    toLabel: "Praha, Malostranská",
    at: "2026-10-06T08:00:00Z",
    country: "CZ",
    ...extra,
  }).toString();
test("snapshot-bound stops survive the URL and stale selections cannot display another journey", async ({
  page,
}) => {
  const revision = "a".repeat(64);
  const snapshotId = (external: string) =>
    Buffer.from(
      JSON.stringify(["tram", "otp", "stop", external, null, revision]),
    ).toString("base64url");
  const from = snapshotId("cz:S12689");
  const to = snapshotId("cz:S12929");
  let searches = 0;
  await page.route("**/api/transport/search/**", async (route) => {
    const body = route.request().postDataJSON();
    expect(body["from-dest"].id).toBe(from);
    expect(body["to-dest"].id).toBe(to);
    searches++;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "stale_resource" }),
    });
  });
  const params = query({
    from,
    to,
    fromLabel: "Brno, Grohova",
    toLabel: "Brno, Tábor",
    city: "Brno",
  });
  await page.goto("/spojeni/?" + params);
  for (let refresh = 0; refresh < 2; refresh++) {
    await expect(
      page.getByRole("heading", { name: "Jízdní řád se změnil.", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".journey-card")).toHaveCount(0);
    await expect(page.locator("#place-from")).toHaveValue("Brno, Grohova");
    await expect(page.locator("#place-to")).toHaveValue("Brno, Tábor");
    if (refresh === 0) await page.reload();
  }
  expect(searches).toBe(2);
});
test("search URL survives refresh; details are local and start closed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Svět je blíž, než si myslíš." }),
  ).toBeVisible();
  await page.locator("#place-from").fill("Muzeum");
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await page.locator("#place-to").fill("Malostranská");
  await page.getByRole("option", { name: "Praha, Malostranská" }).click();
  await page.locator("#travel-day").fill("2026-10-06");
  await page.locator("#travel-time").fill("10:00");
  await page.getByLabel("Pouze přímá spojení", { exact: true }).check();
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  await expect(page).toHaveURL(/\/spojeni\/.*direct=1/);
  await expect(page.locator(".journey-card")).toHaveCount(1);
  await expect(page.locator("#place-from")).toHaveValue("Praha, Muzeum");
  await page.locator(".journey-summary").click();
  await expect(page).not.toHaveURL(/journey=/);
  await expect(page.locator(".journey-detail")).toBeVisible();
  const detail = page.url();
  await page.reload();
  await expect(page.locator(".journey-detail")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  expect(page.url()).toBe(detail);
  await page
    .getByRole("link", { name: "Zastávky spoje 22", exact: true })
    .click();
  await expect(page).not.toHaveURL(/leg=0/);
  await expect(page.locator(".trip-stops li")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-trip-dialog]")).not.toBeVisible();
  await page.locator("[data-trip-open]").first().click();
  await expect(page.locator(".trip-stops li")).toHaveCount(3);
});
test("arrival, partial and fallback results remain visible after refresh", async ({
  page,
}) => {
  await page.goto("/spojeni/?" + query({ arrive: "1" }));
  await expect(
    page.getByRole("radio", { name: "Příjezd", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(
    page.getByText("Záložní jízdní řád", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Výsledky nemusí být úplné/)).toBeVisible();
  await page.reload();
  await expect(page.locator(".journey-card")).toHaveCount(2);
});
test("empty, unsupported and failed searches are honest states", async ({
  page,
}) => {
  for (const [country, text] of [
    ["FR", "Pro toto zadání jsme nenašli spojení."],
    ["US", "Tato cesta zatím není v našem pokrytí."],
    ["DE", "Spojení teď nemůžeme načíst."],
  ]) {
    await page.goto("/spojeni/?" + query({ country }));
    await expect(
      page.getByRole("heading", { name: text, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".journey-card")).toHaveCount(0);
  }
});
test("map dialogs are local; only the selected search point survives refresh", async ({
  page,
}) => {
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator('[data-map="from"]')).toBeEnabled();
  await expect(page.locator('[data-map="to"]')).toBeDisabled();
  await page.goto(
    "/?fromKind=coordinates&fromLat=50.07&fromLon=14.42&fromLabel=Vybrany+bod",
  );
  await page.getByRole("button", { name: "Vybrat na mapě – Odkud" }).click();
  await expect(page).not.toHaveURL(/map=from/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator("[data-map-canvas] .ol-viewport canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-map-error]")).toBeHidden();
  await page.locator("[data-lat]").fill("50.08");
  await page.locator("[data-lon]").fill("14.41");
  await page.getByRole("button", { name: "Použít toto místo" }).click();
  await expect(page).toHaveURL(/fromLat=50.08/);
  await page.reload();
  await expect(page.locator("#place-from")).toHaveValue(/50.0800/);
  await page.locator("#place-to").fill("Muzeum");
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await page.getByRole("button", { name: "Vybrat na mapě – Kam" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Vybrat na mapě – Kam" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator("[data-map-canvas] .ol-viewport canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-map-error]")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(page.url()).not.toContain("map=");
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  await page.getByRole("link", { name: "Trasa na mapě" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator("[data-map-canvas] .ol-viewport canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-map-error]")).toBeHidden();
  await expect(
    page.getByText(
      "Plánovaná trasa a zastávky. Mapa nezobrazuje polohu vozidla.",
    ),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".journey-summary").first().click();
  await page.getByRole("link", { name: "Trasa na mapě" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator("[data-map-canvas] .ol-viewport canvas"),
  ).toBeVisible();
  await expect(page.locator("[data-map-error]")).toBeHidden();
});
test("GPS is fresh on every refresh and never stored in the URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 50.08, longitude: 14.41 });
  const params = new URLSearchParams(query());
  params.delete("from");
  params.delete("fromLabel");
  params.set("fromKind", "current_location");
  let body: any;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/transport/search/"))
      body = request.postDataJSON();
  });
  await page.goto("/spojeni/?" + params);
  await expect(page.locator(".journey-card")).toHaveCount(2);
  expect(body["from-dest"].lat).toBe(50.08);
  await expect(page.locator("[data-nearest-stop]")).toHaveCount(0);
  await expect(
    page.getByText("Pěší cesta mezi polohou a zastávkou není započítaná."),
  ).toHaveCount(0);
  expect(page.url()).not.toContain("50.08");
  expect(page.url()).not.toContain("observed");
  await context.setGeolocation({ latitude: 50.09, longitude: 14.42 });
  await page.reload();
  await expect(page.locator(".journey-card")).toHaveCount(2);
  expect(body["from-dest"].lat).toBe(50.09);
  await expect(page.locator("[data-nearest-stop]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test("GPS denial is recoverable and never falls back to a historical point", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) =>
          fail({ code: 1 }),
      },
    });
  });
  await page.goto("/spojeni/?" + query({ fromKind: "current_location" }));
  await expect(
    page.getByRole("heading", { name: /Polohu se nepodařilo získat/ }),
  ).toBeVisible();
  await expect(page.locator(".journey-card")).toHaveCount(0);
});
test("public read-only POST autocomplete and GPS do not require a site origin", async ({
  request,
}) => {
  const headers = { Origin: "http://localhost:4328" };
  const location = {
    latitude: 50.075,
    longitude: 14.43,
    observed_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    state: "CZ",
  };
  for (const q of [location, { ...location, name: { $regex: "Muzeum" } }]) {
    const response = await request.post("/api/transport/places/", {
      headers,
      data: { q },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].name).toBe("Praha, Muzeum");
  }
  const missingOrigin = await request.post("/api/transport/places/", {
    data: { q: { state: "CZ", name: { $regex: "Muzeum" } } },
  });
  expect(missingOrigin.status()).toBe(200);
  const foreignPort = await request.post("/api/transport/places/", {
    headers: { Origin: "http://localhost:4321" },
    data: { q: { state: "CZ", name: { $regex: "Muzeum" } } },
  });
  expect(foreignPort.status()).toBe(200);
});
test("mutations reject foreign origins and public reads validate input without exposing secrets", async ({
  request,
}) => {
  const response = await request.post("/api/transport/tracking/", {
    headers: { Origin: "https://evil.test" },
    data: {},
  });
  expect(response.status()).toBe(403);
  const read = await request.post("/api/transport/search/", {
    headers: { Origin: "https://evil.test" },
    data: {},
  });
  expect(read.status()).toBe(422);
  const invalid = await request.get(
    "/api/transport/places/?q=" +
      encodeURIComponent(JSON.stringify({ url: "https://evil.test" })),
  );
  expect(invalid.status()).toBe(422);
  const good = await request.get(
    "/api/transport/places/?q=" +
      encodeURIComponent(JSON.stringify({ name: { $regex: "Praha" } })),
    { headers: { "X-Forwarded-Host": "evil.test", "X-Internal-Key": "evil" } },
  );
  expect(good.status()).toBe(200);
  expect(await good.text()).not.toContain("test-only-secret");
});
test("responsive landing and result screenshots with no horizontal overflow", async ({
  page,
}, info) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator("#place-from")).toBeEnabled();
    await page
      .locator(".hero-art img")
      .evaluate((img: HTMLImageElement) => img.decode());
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`home-${width}.png`),
      fullPage: true,
    });
    await page.goto("/spojeni/?" + query());
    await expect(page.locator(".journey-card")).toHaveCount(2);
    await page.locator(".journey-summary").first().click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`results-${width}.png`),
      fullPage: true,
    });
  }
});
test("localized routes and not-found responses", async ({ page }) => {
  for (const [path, heading] of [
    ["/en/", "The world is closer than you think."],
    ["/de/", "Die Welt ist näher, als du denkst."],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  expect((await page.goto("/missing/"))?.status()).toBe(404);
});

test("a delayed GPS response cannot overwrite a manually selected stop", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const pending: PositionCallback[] = [];
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (ok: PositionCallback) => {
          pending.push(ok);
          (window as any).finishGps = () => {
            for (const callback of pending.splice(0))
              callback({
                timestamp: Date.now(),
                coords: { latitude: 50.08, longitude: 14.41 },
              } as GeolocationPosition);
          };
        },
      },
    });
  });
  await page.goto("/");
  await page.locator('[data-location="from"]').click();
  await page.locator("#place-from").fill("Muzeum");
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await page.evaluate(() => (window as any).finishGps());
  await expect(page.locator('[data-location="from"]')).toBeEnabled();
  await expect(page.locator("#place-from")).toHaveValue("Praha, Muzeum");
  await expect(page.locator("#suggestions-from")).not.toBeVisible();
});

test("both place fields distinguish missing data sources from an empty response", async ({
  page,
}) => {
  await page.route("**/api/transport/places/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ success: false, error: "places_not_configured" }),
    }),
  );
  await page.goto("/");
  for (const side of ["from", "to"]) {
    await page.locator(`#place-${side}`).fill("Tabor");
    await expect(page.locator(`[data-hint=${side}]`)).toHaveText(
      "Pro tuto oblast zatím nejsou připojené zdroje zastávek.",
    );
    await expect(page.locator(`#suggestions-${side}`)).toBeHidden();
  }
});

test("country and city scope reaches autocomplete and persists in journey URLs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Česká republika" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.locator("#travel-city").click();
  await page
    .locator("#city-options")
    .getByRole("option", { name: "Praha", exact: true })
    .click();
  const request = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
  );
  await page.locator("#place-from").fill("Muzeum");
  const sent = await request;
  expect(JSON.parse(new URL(sent.url()).searchParams.get("q")!)).toEqual({
    name: { $regex: "Muzeum" },
    state: "CZ",
    city: "Praha",
  });
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await page.locator("#place-to").fill("Malostranská");
  await page.getByRole("option", { name: "Praha, Malostranská" }).click();
  await page
    .getByRole("button", { name: "Hledat spojení", exact: true })
    .click();
  await expect(page).toHaveURL(/city=Praha/);
  await page.reload();
  await expect(page.locator("#travel-city")).toHaveValue("Praha");
  await expect(page.locator(".journey-card").first()).toBeVisible();
});

test("switching a supported country clears the old city and places before autocomplete", async ({
  page,
}) => {
  await page.route("**/api/transport/coverage/", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: [
          {
            state: "CZ",
            capabilities: ["places", "journeys", "cities"],
            searchAvailable: true,
            citiesAvailable: true,
          },
          {
            state: "SK",
            capabilities: ["places", "journeys", "cities"],
            searchAvailable: true,
            citiesAvailable: true,
          },
        ],
      },
    }),
  );
  await page.goto(
    "/?country=CZ&city=Brno&fromKind=stop&from=" +
      id("S4") +
      "&fromLabel=Brno%2C%20Grohova",
  );
  await expect(page.locator("#place-from")).toBeEnabled();
  await page.locator("#country-sk").click();
  await expect(page.locator("#travel-country")).toHaveValue("SK");
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
  await expect(page.locator("#place-from")).toHaveValue("Moje aktuální poloha");
  const request = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
  );
  await page.locator("#place-from").fill("Hlavna");
  expect(
    JSON.parse(new URL((await request).url()).searchParams.get("q")!),
  ).toEqual({ name: { $regex: "Hlavna" }, state: "SK" });
});

test("an unsupported country URL does not load catalogues or allow a search and offers a supported tab", async ({
  page,
}) => {
  const lookups: string[] = [];
  page.on("request", (r) => {
    if (/\/api\/transport\/(places|cities|search)\//.test(r.url()))
      lookups.push(r.url());
  });
  await page.goto("/?country=AT&city=Brno");
  await expect(
    page.locator(".notice").filter({
      hasText: "Vyhledávání spojení pro tuto zemi zatím není dostupné.",
    }),
  ).toBeVisible();
  await expect(page.locator("#place-from")).toBeDisabled();
  await expect(page.locator("#country-world")).toHaveAttribute("tabindex", "0");
  expect(lookups).toEqual([]);
  await page.locator("#country-cz").click();
  await expect(page.locator("#place-from")).toBeEnabled();
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
});

test("autocomplete uses fresh GPS automatically in POST only and explicit city takes priority", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.195, longitude: 16.61 });
  await page.goto("/");
  await expect(page.locator("[data-scope-location]")).toHaveCount(0);
  const pending = page.waitForRequest(
    (r) =>
      r.url().includes("/api/transport/places/") &&
      r.method() === "POST" &&
      r.postDataJSON()?.q?.name?.$regex === "Muzeum",
  );
  await page.locator("#place-from").fill("Muzeum");
  const request = await pending;
  expect(request.method()).toBe("POST");
  expect(new URL(request.url()).search).toBe("");
  expect(request.postDataJSON().q.latitude).toBe(49.195);
  expect(
    Date.now() - Date.parse(request.postDataJSON().q.observed_at),
  ).toBeLessThan(30000);
  await expect(
    page.getByRole("option", { name: "Praha, Muzeum" }),
  ).toBeVisible();
  await page.locator("#travel-city").click();
  await page
    .locator("#city-options")
    .getByRole("option", { name: "Praha", exact: true })
    .click();
  const explicit = page.waitForRequest(
    (r) =>
      r.url().includes("/api/transport/places/") &&
      r.method() === "POST" &&
      r.postDataJSON()?.q?.name?.$regex === "Muzeum",
  );
  await page.locator("#place-from").fill("Muzeum");
  const explicitRequest = await explicit;
  expect(explicitRequest.method()).toBe("POST");
  expect(explicitRequest.postDataJSON().q).toMatchObject({
    name: { $regex: "Muzeum" },
    city: "Praha",
    state: "CZ",
    latitude: 49.195,
    longitude: 16.61,
  });
});

test("city picker defaults to all and offers online municipalities", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("tab")).toHaveCount(6);
  await expect(page.locator("#country-cz")).toBeEnabled();
  for (const country of ["sk", "at", "pl", "de"])
    await expect(page.locator(`#country-${country}`)).toBeDisabled();
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
  await page.locator("#travel-city").click();
  await expect(
    page
      .locator("#city-options")
      .getByRole("option", { name: "Brno", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#city-options")
      .getByRole("option", { name: "Brno", exact: true }),
  ).toContainText("Česká republika · Jihomoravský kraj · okres Brno-město");
  await page.locator("#travel-city").fill("Brn");
  await page
    .locator("#city-options")
    .getByRole("option", { name: "Brno", exact: true })
    .click();
  await expect(page.locator("#travel-city")).toHaveValue("Brno");
  await page.locator("#place-from").fill("Grohova");
  await expect(
    page.getByRole("option", { name: "Brno, Grohova" }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Brno, Grohova" }),
  ).toContainText(
    "Česká republika · Jihomoravský kraj · okres Brno-město · Brno",
  );
});

test("search auto selects one city and resets intercity routes to all timetables", async ({
  page,
}) => {
  await page.goto("/spojeni/?" + query());
  await expect(page.locator("#travel-city")).toHaveValue("Praha");
  await expect(page).toHaveURL(/city=Praha/);
  await page.reload();
  await expect(page.locator("#travel-city")).toHaveValue("Praha");
  await page.goto(
    "/spojeni/?" +
      query({ from: id("S4"), fromLabel: "Brno, Grohova", city: "Brno" }),
  );
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
  expect(new URL(page.url()).searchParams.has("city")).toBe(false);
  await expect(page.locator("#place-from")).toHaveValue("Brno, Grohova");
});

test("line opens full-trip dialog; middle button shows only intermediate stops; reopening reuses static stops", async ({
  page,
}) => {
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  const card = page.locator(".journey-card.is-open");
  await expect(card.locator('.leg-title svg[data-mode="tram"]')).toBeVisible();
  await card.locator('[data-trip-open="0"]').click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-trip-dialog-stops] li")).toHaveCount(3);
  await expect(card.locator("[data-trip-dialog-stops]")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await card.locator('[data-trip-open="0"]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-trip-dialog-stops] li")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(card.locator('[data-trip-open="0"]')).toBeFocused();
  // Return a full trip with stops before/after the selected segment and one stop between.
  await page.route("**/api/transport/trip/**", async (route) => {
    const stop = (s: string) => ({
      id: id(s),
      name: s === "S3" ? "Pouze mezilehlá" : s,
      lat: null,
      lon: null,
      platform: null,
    });
    await route.fulfill({
      json: {
        success: true,
        data: {
          sourceMode: "live",
          stops: ["OUTSIDE1", "S1", "S3", "S2", "OUTSIDE2"].map((s) => ({
            stop: stop(s),
            arrival: null,
            departure: null,
          })),
        },
      },
    });
  });
  await card.locator('[data-trip-open="0"]').click();
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await card.locator('[data-trip-open="0"]').click(); // A new view loads the changed static fixture.
  const highlighted = dialog.locator(".is-selected-segment");
  await expect(highlighted.locator(".trip-stop-name")).toHaveText([
    "S1",
    "Pouze mezilehlá",
    "S2",
  ]);
  await expect(highlighted.first().locator(".trip-stop-name")).toHaveCSS(
    "font-weight",
    "800",
  );
  await expect(
    dialog.locator(".trip-call:not(.is-selected-segment) .trip-stop-name"),
  ).toHaveText(["OUTSIDE1", "OUTSIDE2"]);
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await card.locator('[data-trip-open="0"]').click();
  await expect(highlighted).toHaveCount(3);
  await page.keyboard.press("Escape");
  await card.locator(".intermediate-toggle").click();
  const list = card.locator("[data-intermediate-stops]");
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list).toContainText("Pouze mezilehlá");
  await expect(list).not.toContainText("OUTSIDE");
  const middleStop = list.locator('[data-trip-stop-map="2"]');
  const lookup = page.waitForResponse((r) =>
    r.url().includes("/api/transport/stop/"),
  );
  await middleStop.click();
  const stopResponse = await lookup;
  expect(new URL(stopResponse.url()).searchParams.get("id")).toBe(id("S3"));
  const map = page.locator("[data-map-dialog]");
  await expect(map.locator("h2")).toHaveText("Pouze mezilehlá");
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(dialog).not.toBeVisible();
  expect(new URL(page.url()).searchParams.has("leg")).toBe(false);
  await page.keyboard.press("Escape");
  await middleStop.click();
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(map.locator("h2")).toHaveText("Pouze mezilehlá");
  await page.keyboard.press("Escape");
  await expect(map).not.toBeVisible();
  await expect(middleStop).toBeFocused();
  await expect(page).not.toHaveURL(/stops=0/);
  await expect(list).toContainText("Pouze mezilehlá");
  await expect(dialog).not.toBeVisible();
});

test("stop map fetches missing coordinates; read-only marker supports reopening and failures show no invented location", async ({
  page,
}) => {
  await page.route("**/api/transport/search/**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    for (const j of payload.data.journeys)
      for (const leg of j.legs) {
        leg.from.lat = null;
        leg.from.lon = null;
        leg.to.lat = null;
        leg.to.lon = null;
      }
    await route.fulfill({ json: payload });
  });
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/stop/"),
  );
  await page.locator(".journey-detail .stop-map-link").nth(1).click();
  const payload = await (await response).json();
  expect(payload.data.name).toBe("Praha, Malostranská");
  expect(JSON.stringify(payload)).not.toContain("DO_NOT_EXPOSE");
  const dialog = page.locator("[data-map-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toHaveText("Praha, Malostranská");
  await expect(dialog.locator("canvas").first()).toBeVisible();
  await expect(dialog.locator("[data-map-form]")).not.toBeVisible();
  await expect(page).not.toHaveURL(/map=stop/);
  await page.keyboard.press("Escape");
  await page.locator(".journey-detail .stop-map-link").nth(1).click();
  await expect(dialog.locator("canvas").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.route("**/api/transport/stop/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await page.locator(".journey-detail .stop-map-link").nth(1).click();
  await expect(dialog.locator("[data-map-error]")).toHaveText(
    "Polohu zastávky se nepodařilo načíst.",
  );
  await expect(dialog.locator("[data-map-canvas]")).not.toBeVisible();
});

test("place map buttons require a selection, focus selects the text and city shares the field appearance", async ({
  page,
}) => {
  await page.goto("/");
  const from = page.locator("#place-from"),
    to = page.locator("#place-to");
  await expect(page.locator('[data-map="from"]')).toBeEnabled();
  await from.fill("Muzeum");
  await expect(page.locator('[data-map="from"]')).toBeDisabled();
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await expect(page.locator('[data-map="from"]')).toBeEnabled();
  await to.click();
  await from.click();
  expect(
    await from.evaluate((e: HTMLInputElement) =>
      e.value.slice(e.selectionStart!, e.selectionEnd!),
    ),
  ).toBe("Praha, Muzeum");
  await page.keyboard.type("Národní");
  await expect(from).toHaveValue("Národní");
  await expect(page.locator('[data-map="from"]')).toBeDisabled();
  await page.getByRole("option", { name: "Praha, Národní třída" }).click();
  await page.locator('[data-map="from"]').click();
  await expect(page.locator("#map-title")).toHaveText("Praha, Národní třída");
  await expect(page.locator("[data-map-dialog] canvas").first()).toBeVisible();
  await expect(page.locator("[data-map-form]")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("[data-swap]").click();
  await expect(page.locator('[data-map="from"]')).toBeDisabled();
  await expect(page.locator('[data-map="to"]')).toBeEnabled();
  await to.click();
  expect(
    await to.evaluate(
      (e: HTMLInputElement) => e.selectionEnd! - e.selectionStart!,
    ),
  ).toBe("Praha, Národní třída".length);
  await page.keyboard.press("Backspace");
  await expect(to).toHaveValue("");
  await expect(page.locator('[data-map="to"]')).toBeDisabled();
  const appearance = await page
    .locator('.city-picker .place-input, [data-place="from"] .place-input')
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const s = getComputedStyle(n),
          i = getComputedStyle(n.querySelector("input")!);
        return [s.borderRadius, s.minHeight, s.padding, i.fontSize, i.height];
      }),
    );
  expect(appearance[0]).toEqual(appearance[1]);
});

test("GPS offers optional nearby stops using POST, selection changes to a public stop", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 50.08, longitude: 14.41 });
  await page.goto("/");
  const request = page.waitForRequest(
    (r) => r.url().includes("/api/transport/places/") && r.method() === "POST",
  );
  await page.locator('[data-location="from"]').click();
  const sent = await request;
  expect(sent.postDataJSON().q.name).toBeUndefined();
  expect(sent.postDataJSON().q.latitude).toBe(50.08);
  await expect(page.locator("#suggestions-from [role=option]")).toHaveCount(3);
  await expect(page.locator("#place-from")).toHaveValue("Moje aktuální poloha");
  await expect(page.locator('[data-map="from"]')).toBeEnabled();
  await expect(
    page.getByText("GPS se neukládá. Po obnovení získáme novou polohu."),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "Praha, Muzeum" }).click();
  await expect(page.locator("#place-from")).toHaveValue("Praha, Muzeum");
  await page.locator('[data-map="from"]').click();
  expect(new URL(page.url()).searchParams.get("fromKind")).toBe("stop");
  expect(page.url()).not.toContain("50.08");
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
});

test("GPS map stays fresh, never stores coordinates and ends tracking on close", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const position = () =>
      ({
        timestamp: Date.now(),
        coords: { latitude: 50.08, longitude: 14.41 },
      }) as GeolocationPosition;
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (ok: PositionCallback) => ok(position()),
        watchPosition: (ok: PositionCallback) => {
          (window as any).updateGps = ok;
          return 7;
        },
        clearWatch: (id: number) => {
          (window as any).clearedGps = id;
        },
      },
    });
  });
  await page.goto("/");
  await page.locator('[data-location="from"]').click();
  await expect(page.locator("#suggestions-from")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator('[data-map="from"]').click();
  const canvas = page.locator("[data-map-canvas]");
  await expect(canvas.locator("canvas").first()).toBeVisible();
  await expect(page.locator("[data-map-form]")).not.toBeVisible();
  expect(new URL(page.url()).searchParams.get("fromKind")).toBe(
    "current_location",
  );
  expect(page.url()).not.toContain("Lat");
  await page.evaluate(() =>
    (window as any).updateGps({
      timestamp: Date.now() - 60000,
      coords: { latitude: 50.08, longitude: 14.41 },
    }),
  );
  await expect(canvas).not.toBeVisible();
  await page.evaluate(() =>
    (window as any).updateGps({
      timestamp: Date.now(),
      coords: { latitude: 50.09, longitude: 14.42 },
    }),
  );
  await expect(canvas).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => (window as any).clearedGps)).toBe(7);
});

test("trip dialog displays provider legend with links, refresh, and clears old metadata on error", async ({
  page,
}) => {
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/trip/"),
  );
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click();
  const payload = await (await response).json();
  expect(JSON.stringify(payload)).not.toContain("DO_NOT_EXPOSE");
  expect(payload.data.metadata.vehicle_position).toBeUndefined();
  const legend = page.locator("[data-trip-legend]");
  await expect(legend).toHaveCount(0);
  const notes = page.locator("[data-trip-notes]");
  await expect(notes).toContainText("Testovací dopravce");
  await expect(notes).toContainText(
    "Garantovaná návaznost dle testovacího jízdního řádu.",
  );
  await expect(
    notes.getByRole("link", { name: "www.example.test/tarif" }),
  ).toHaveAttribute("href", "https://www.example.test/tarif");
  await expect(notes.locator("svg")).toHaveCount(3);
  expect(
    await notes.evaluate(
      (el) =>
        !!(
          el.compareDocumentPosition(
            document.querySelector("[data-trip-dialog-stops]")!,
          ) & Node.DOCUMENT_POSITION_PRECEDING
        ),
    ),
  ).toBe(true);
  const route = page.locator("#trip-title .trip-title-route");
  const routeName = `${payload.data.stops[0].stop.name} – ${payload.data.stops.at(-1).stop.name}`;
  await expect(route).toHaveText(routeName);
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click();
  await expect(legend).toHaveCount(0);
  await expect(route).toHaveText(routeName);
  await page.keyboard.press("Escape");
  await page.route("**/api/transport/trip/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await page.locator('[data-trip-open="0"]').click();
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click(); // Previously loaded details are intentionally reused until leaving this view.
  await expect(page.locator("[data-trip-dialog-stops]")).toHaveText(
    "Podrobnosti spoje teď nejsou dostupné.",
  );
  await expect(legend).not.toBeVisible();
  await expect(legend).toHaveCount(0);
  await expect(route).toHaveCount(0);
});

test("trip stop columns show tariff zone, request-stop explanation and source kilometrage on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/trip/"),
  );
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click();
  const data = (await (await response).json()).data;
  expect(data.stops[1].routeKm).toBe(0.303);
  expect(data.stops[1].requestStop).toBe(true);
  expect(data.stops[1].tariffZones).toEqual([{ system: "PID", zone: "P" }]);
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog.locator("[data-trip-columns]")).toBeVisible();
  await expect(dialog.locator("[data-trip-stop-legend]")).toHaveText(
    "z = zastávka na znamení",
  );
  await expect(dialog.locator(".trip-stop-km").nth(0)).toContainText("0 km");
  await expect(dialog.locator(".trip-stop-km").nth(1)).toContainText(
    "0,303 km",
  );
  await expect(dialog.locator(".trip-stop-km").nth(2)).toContainText(
    "1,227 km",
  );
  await expect(dialog.locator(".request-stop")).toHaveCount(2);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click();
  await expect(dialog.locator(".trip-stop-km").nth(2)).toContainText(
    "1,227 km",
  );
});

test("trip stop opens a map above the trip dialog with local state, focus return and lookup failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/transport/trip/**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    for (const call of payload.data.stops) {
      call.stop.lat = null;
      call.stop.lon = null;
    }
    await route.fulfill({ json: payload });
  });
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').click();
  const tripDialog = page.locator("[data-trip-dialog]");
  const stopLink = tripDialog.locator('[data-trip-stop-map="1"]');
  const map = page.locator("[data-map-dialog]");
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/stop/"),
  );
  await stopLink.click();
  const payload = await (await response).json();
  expect(payload.data.name).toBe("Praha, Malostranská");
  await expect(tripDialog).toBeVisible();
  await expect(map).toBeVisible();
  await expect(map.locator("h2")).toHaveText("Praha, Malostranská");
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(map.locator("[data-map-form]")).not.toBeVisible();
  await expect(page).not.toHaveURL(/tripStop=|leg=/);
  await page.keyboard.press("Escape");
  await stopLink.click();
  await expect(tripDialog).toBeVisible();
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(map.locator("h2")).toHaveText("Praha, Malostranská");
  await page.keyboard.press("Escape");
  await expect(map).not.toBeVisible();
  await expect(tripDialog).toBeVisible();
  await expect(stopLink).toBeFocused();
  await stopLink.press("Enter");
  await expect(map.locator("canvas").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(map).not.toBeVisible();
  await expect(tripDialog).toBeVisible();
  await stopLink.click();
  await expect(map.locator("canvas").first()).toBeVisible();
  await map.locator("[data-close-map]").click();
  await expect(stopLink).toBeFocused();
  await page.route("**/api/transport/stop/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await stopLink.click();
  await expect(map.locator("[data-map-error]")).toHaveText(
    "Polohu zastávky se nepodařilo načíst.",
  );
  await expect(map.locator("[data-map-canvas]")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stopLink).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tripDialog).not.toBeVisible();
});

test("missing inferred area keeps selected Třebíč in the form and URL after search and refresh", async ({
  page,
}) => {
  let searches = 0;
  await page.route("**/api/transport/search/**", async (route) => {
    searches++;
    expect(route.request().postDataJSON().city).toBe("Třebíč");
    const response = await route.fetch();
    const body = await response.json();
    body.data.city = null;
    body.data.intercity = false;
    await route.fulfill({ json: body });
  });
  await page.goto(
    "/spojeni/?" +
      query({
        city: "Třebíč",
        fromLabel: "Třebíč, Hrotovická",
        toLabel: "Třebíč, Kubišova",
      }),
  );
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(page.locator("#travel-city")).toHaveValue("Třebíč");
  expect(new URL(page.url()).searchParams.get("city")).toBe("Třebíč");
  expect(searches).toBe(1);
  await page.reload();
  await expect(page.locator(".journey-card")).toHaveCount(2);
  await expect(page.locator("#travel-city")).toHaveValue("Třebíč");
  expect(searches).toBe(2);
});

test("trip equipment is visible below stops and technical timetable codes need explicit expansion", async ({
  page,
}) => {
  await page.route("**/api/transport/trip/**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    Object.assign(body.data.metadata, {
      features: ["BICYCLE_TRANSPORT", "WIFI", "TOILETS", "SOCKETS_230V"],
      accessibility: "accessible",
      reservations: { bicycle: "mandatory" },
    });
    body.data.metadata.notes.push({
      scope: "line",
      category: "technical",
      texts: { cs: "Grafikony: PD: T2610 SN: T2609 Pz: P2610" },
      defaultLanguage: "cs",
    });
    await route.fulfill({ json: body });
  });
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  await page.locator('[data-trip-open="0"]').first().click();
  const notes = page.locator("[data-trip-notes]");
  await expect(notes.getByText(/Přeprava jízdních kol/)).toBeVisible();
  await expect(
    notes.getByText(/Bezbariérové vozidlo podle jízdního řádu/),
  ).toBeVisible();
  await expect(notes.locator(".trip-legend li")).not.toHaveCount(3);
  await expect(notes.getByText(/^Grafikony:/)).toBeHidden();
  await notes.locator("summary").click();
  await expect(notes.getByText(/^Grafikony:/)).toBeVisible();
});

test("live vehicle tracking shares the selected journey, shows delay and removes expired GPS", async ({
  page,
}) => {
  let pushDelay: (seconds: number) => void = () => {};
  let sessions = 0,
    closed = 0;
  await page.route("**/api/transport/tracking/", async (route) => {
    sessions++;
    const { id } = route.request().postDataJSON();
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/fixture-tracking",
          ticket: id,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    });
  });
  await page.routeWebSocket("ws://localhost:4328/fixture-tracking", (ws) => {
    ws.onClose(() => {
      closed++;
    });
    ws.onMessage((message) => {
      const m = JSON.parse(String(message));
      if (m.type !== "subscribe") return;
      pushDelay = (seconds) => {
        const now = Date.now();
        ws.send(
          JSON.stringify({
            type: "observation",
            trip: m.ticket,
            data: {
              status: "live",
              position: { lat: 50.08, lon: 14.42 },
              observed_at: new Date(now).toISOString(),
              valid_until: new Date(now + 4000).toISOString(),
              delay_seconds: seconds,
              cancelled: false,
            },
          }),
        );
      };
      pushDelay(480);
    });
  });
  await page.goto(`/spojeni/?${query()}`);
  const scheduledTime = await page
    .locator(".journey-summary .journey-time")
    .first()
    .innerText();
  const originalDuration =
    (await page.locator(".journey-duration").first().textContent()) ?? "";
  await page.locator(".journey-summary").first().click();
  await expect(page.locator(".journey-detail [data-delay-badge]")).toHaveText(
    "Zpoždění 8 min",
  );
  await expect(
    page.locator(".journey-summary .journey-time").first(),
  ).toHaveText(scheduledTime);
  await expect(page.locator(".journey-duration").first()).toHaveText(
    originalDuration,
  );
  await page.locator("[data-trip-open]").first().click();
  await expect(
    page.locator("[data-trip-dialog] .trip-sticky-header [data-delay-badge]"),
  ).toHaveText("Zpoždění 8 min");
  expect(sessions).toBe(1);
  await expect(
    page.locator("[data-trip-dialog] .trip-stops time").first(),
  ).toHaveText("10:00");
  await expect(
    page.locator("[data-trip-dialog] [data-delay-badge]"),
  ).toHaveAttribute("data-stale", "true", { timeout: 8000 });
  const badge = page.locator(".journey-detail .leg-title [data-delay-badge]");
  await expect(badge).toHaveText("Zpoždění 8 min");
  await expect(badge).toHaveAttribute("data-stale", "true");
  await expect(
    page.getByText("Příjezd je odhadnut podle aktuálního zpoždění.", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await badge.evaluate((el) =>
      el.previousElementSibling?.matches("[data-trip-open]"),
    ),
  ).toBe(true);
  pushDelay(0);
  await expect(badge).toHaveCount(0);
  await expect(
    page.locator("[data-trip-dialog] [data-delay-badge]"),
  ).toHaveCount(0);
  pushDelay(120);
  await expect(badge).toHaveText("Zpoždění 2 min");
  await expect(badge).toHaveAttribute("data-status", "delayed");
  await page.locator("[data-close-trip]").click();
  await page.locator(".journey-summary").first().click();
  await expect.poll(() => closed).toBe(1);
});

for (const width of [390, 1280]) {
  test(`trip timeline places live GPS between row anchors and follows resizing (${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let push: (lat: number, lon: number, ttl?: number) => void = () => {};
    await page.route("**/api/transport/tracking/", async (route) => {
      const { id } = route.request().postDataJSON();
      await route.fulfill({
        json: {
          success: true,
          data: {
            status: "available",
            url: "ws://localhost:4328/timeline-fixture",
            ticket: id,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        },
      });
    });
    await page.routeWebSocket("ws://localhost:4328/timeline-fixture", (ws) => {
      ws.onMessage((message) => {
        const m = JSON.parse(String(message));
        if (m.type !== "subscribe") return;
        push = (lat, lon, ttl = 30000) => {
          const now = Date.now();
          ws.send(
            JSON.stringify({
              type: "observation",
              trip: m.ticket,
              data: {
                status: "live",
                position: { lat, lon },
                observed_at: new Date(now).toISOString(),
                valid_until: new Date(now + ttl).toISOString(),
                delay_seconds: 480,
                cancelled: false,
              },
            }),
          );
        };
        push(50.0775, 14.4255);
      });
    });
    await page.goto(`/spojeni/?${query()}`);
    await page.locator(".journey-summary").first().click();
    await page.locator("[data-summary-trip]").first().click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog.locator("[data-trip-point]")).toHaveCount(3);
    const dot = dialog.locator("[data-trip-vehicle-dot]");
    await expect(dot).toHaveAttribute("data-from", "0");
    await expect(dot).toHaveAttribute("data-to", "1");
    await expect(dot).toHaveAttribute(
      "aria-label",
      /mezi zastávkami Praha, Muzeum a Praha, Malostranská/,
    );
    const aligned = () =>
      dialog.evaluate((element) => {
        const a = element
            .querySelector('[data-trip-point="0"]')!
            .getBoundingClientRect(),
          b = element
            .querySelector('[data-trip-point="1"]')!
            .getBoundingClientRect(),
          marker = element
            .querySelector("[data-trip-vehicle-dot]")!
            .getBoundingClientRect(),
          clock = element
            .querySelector(".trip-call time")!
            .getBoundingClientRect();
        const markerY = marker.y + marker.height / 2,
          mean = (a.y + a.height / 2 + b.y + b.height / 2) / 2;
        return (
          Math.abs(markerY - mean) < 2 &&
          Math.abs(marker.x + marker.width / 2 - a.x - a.width / 2) < 2 &&
          a.right < clock.left
        );
      });
    await expect.poll(aligned).toBe(true);
    await dialog.locator("[data-trip-timeline]").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("timeline.png") });
    await page.setViewportSize({
      width: width === 390 ? 950 : 390,
      height: 800,
    });
    await expect.poll(aligned).toBe(true);
    push(50.2, 14.6);
    await expect(dot).toHaveAttribute("data-retained", "true");
    await expect(dot).toHaveAttribute("data-from", "0");
    await expect(dot).toHaveAttribute("data-to", "1");
    await expect.poll(aligned).toBe(true);
    await expect(dot).toHaveAttribute(
      "aria-label",
      /Poslední jednoznačná poloha/,
    );
    push(50.08, 14.421);
    await expect(dot).not.toHaveAttribute("data-retained", "true");
    await expect(dot).toHaveAttribute("data-from", "1");
    await expect(dot).toHaveAttribute("data-to", "1");
    await expect(dot).toHaveAttribute(
      "aria-label",
      /u zastávky Praha, Malostranská/,
    );
    push(50.08, 14.421, 1200);
    // After expiry, retain the last resolved point while awaiting another measurement.
    await expect(dot).toBeVisible();
    await page.waitForTimeout(100);
    push(50.2, 14.6);
    await expect(dot).toHaveAttribute("data-retained", "true");
    await expect(dot).toHaveAttribute("data-from", "1");
    await page.waitForTimeout(1400);
    await expect(dot).toBeVisible();
    await expect(dot).toHaveAttribute("data-retained", "true");
    push(50.08, 14.421);
    await expect(dot).not.toHaveAttribute("data-retained", "true");
    await expect(dot).toHaveAttribute("data-from", "1");
    await expect(dot).toHaveAttribute("data-to", "1");
    await expect(dialog.locator("[data-trip-point]")).toHaveCount(3);
  });
}

test("unsupported tracking keeps static stops without inventing GPS or an on-time badge", async ({
  page,
}) => {
  await page.route("**/api/transport/search/", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    for (const journey of json.data.journeys)
      for (const leg of journey.legs) {
        leg.realtime = false;
        leg.expectedDeparture = null;
        leg.expectedArrival = null;
        leg.predictionValidUntil = null;
        leg.delaySeconds = null;
      }
    await route.fulfill({ json });
  });
  await page.route("**/api/transport/tracking/", (route) =>
    route.fulfill({ json: { success: true, data: { status: "unsupported" } } }),
  );
  await page.goto(`/spojeni/?${query()}`);
  await page.locator(".journey-summary").first().click();
  await page.locator("[data-summary-trip]").first().click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog.locator("[data-trip-point]")).toHaveCount(3);
  await expect(dialog.locator("[data-trip-vehicle-dot]")).toHaveCount(0);
  await expect(dialog.locator("[data-delay-badge]")).toHaveCount(0);
  await expect(
    dialog.getByText(
      "Poskytovatel pro tento spoj neposkytuje ověřenou živou polohu.",
    ),
  ).toHaveCount(0);
});

test("each accordion service has its own fresh delay badge even when GPS is unsupported", async ({
  page,
}) => {
  const stop = (name: string) => ({
    id: null,
    name,
    lat: 50,
    lon: 14,
    platform: null,
  });
  const common = {
    mode: "tram",
    operator: "",
    geometry: null,
    realtime: true,
    cancelled: false,
    minTransferSeconds: 60,
    predictionValidUntil: new Date(Date.now() + 30000).toISOString(),
  };
  const data = {
    journeys: [
      {
        key: "two-services",
        duration: 3600,
        transfers: 1,
        source: {
          provider: "fixture",
          mode: "live",
          limited: false,
          attribution: "fixture",
        },
        legs: [
          {
            ...common,
            line: "3",
            tripId: "serviceA",
            from: stop("A"),
            to: stop("B"),
            scheduledDeparture: "2026-10-06T08:00:00Z",
            scheduledArrival: "2026-10-06T08:20:00Z",
            expectedDeparture: "2026-10-06T08:08:00Z",
            expectedArrival: "2026-10-06T08:28:00Z",
            delaySeconds: 480,
          },
          {
            ...common,
            line: "12",
            tripId: "serviceB",
            from: stop("B"),
            to: stop("C"),
            scheduledDeparture: "2026-10-06T08:40:00Z",
            scheduledArrival: "2026-10-06T09:00:00Z",
            expectedDeparture: null,
            expectedArrival: "2026-10-06T09:03:00Z",
          },
        ],
      },
    ],
    partial: false,
  };
  await page.route("**/api/transport/search/", (r) =>
    r.fulfill({ json: { success: true, data } }),
  );
  await page.route("**/api/transport/tracking/", (r) =>
    r.fulfill({ json: { success: true, data: { status: "unsupported" } } }),
  );
  await page.goto(`/spojeni/?${query()}`);
  await page.locator(".journey-summary").click();
  await expect(
    page.locator(".journey-detail .leg").nth(0).locator("[data-delay-badge]"),
  ).toHaveText("Zpoždění 8 min");
  await expect(
    page.locator(".journey-detail .leg").nth(1).locator("[data-delay-badge]"),
  ).toHaveText("Zpoždění 3 min");
});

for (const width of [390, 1280]) {
  test(`socket patches keep result order, loaded stops, accordion geometry and dialog scroll stable (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let searches = 0,
      trips = 0;
    let push: (delay: number | null) => void = () => {};
    await page.route("**/api/transport/search/", async (route) => {
      searches++;
      const response = await route.fetch();
      const json = await response.json();
      const original = json.data.journeys[0];
      const later = structuredClone(original);
      later.key = "later-static-result";
      for (const leg of later.legs) {
        for (const field of [
          "scheduledDeparture",
          "scheduledArrival",
          "expectedDeparture",
          "expectedArrival",
        ]) {
          if (leg[field])
            leg[field] = new Date(Date.parse(leg[field]) + 60000).toISOString();
        }
      }
      json.data.journeys = [original, later];
      await route.fulfill({ json });
    });
    await page.route("**/api/transport/trip/**", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      const calls = json.data.stops;
      json.data.stops = [calls[0], calls[2], calls[1]];
      json.data.stops.forEach((call: any, index: number) => {
        call.arrival =
          call.departure = `2026-10-06T08:${["00", "07", "15"][index]}:00Z`;
      });
      await route.fulfill({ json });
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/transport/trip/")) trips++;
    });
    await page.route("**/api/transport/tracking/", async (route) => {
      const { id } = route.request().postDataJSON();
      await route.fulfill({
        json: {
          success: true,
          data: {
            status: "available",
            url: "ws://localhost:4328/stable-tracking",
            ticket: id,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        },
      });
    });
    await page.routeWebSocket(
      "ws://localhost:4328/stable-tracking",
      (socket) => {
        socket.onMessage((message) => {
          const request = JSON.parse(String(message));
          if (request.type !== "subscribe") return;
          push = (delay) => {
            const now = Date.now();
            socket.send(
              JSON.stringify({
                type: "observation",
                trip: request.ticket,
                data:
                  delay === null
                    ? { status: "stale" }
                    : {
                        status: "live",
                        position: { lat: 50.08, lon: 14.42 },
                        observed_at: new Date(now).toISOString(),
                        valid_until: new Date(now + 30000).toISOString(),
                        delay_seconds: delay,
                        cancelled: false,
                      },
              }),
            );
          };
          push(0);
        });
      },
    );
    await page.goto(`/spojeni/?${query()}`);
    const cards = page.locator(".journey-card");
    await expect(cards).toHaveCount(2);
    const first = cards.first();
    await first.locator(".journey-summary").click();
    await first.locator(".intermediate-toggle").click();
    await expect(
      first.locator("[data-intermediate-stops] .trip-call"),
    ).toHaveCount(1);
    await expect(first.locator(".leg-title [data-delay-badge]")).toHaveCount(0);
    await page.waitForTimeout(300);
    const order = await cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-journey")),
    );
    const before = await first.boundingBox();
    const href = page.url();
    await first.evaluate((element) => {
      (window as any).stableNodes = [
        element,
        element.querySelector(".journey-detail"),
        element.querySelector("[data-intermediate-stops] .trip-call"),
        element.querySelector(".stop-map-link"),
      ];
      window.scrollTo({
        top: element.getBoundingClientRect().top + window.scrollY - 100,
        behavior: "instant",
      });
    });
    const scroll = await page.evaluate(() => window.scrollY);
    for (const delay of [480, null, 120, 0]) {
      push(delay);
      if (delay === 0)
        await expect(
          first.locator(".leg-title [data-delay-badge]"),
        ).toHaveCount(0);
      else
        await expect(first.locator(".leg-title [data-delay-badge]")).toHaveText(
          delay === null ? "Zpoždění 8 min" : `Zpoždění ${delay / 60} min`,
        );
      await page.waitForTimeout(250);
      expect(
        await cards.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-journey")),
        ),
      ).toEqual(order);
      await expect(first.locator(".journey-summary-toggle")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(page.url()).toBe(href);
      expect(
        Math.abs((await first.boundingBox())!.height - before!.height),
      ).toBeLessThan(2);
      expect(
        Math.abs((await page.evaluate(() => window.scrollY)) - scroll),
      ).toBeLessThan(2);
      expect(
        await first.evaluate((element) => {
          const previous = (window as any).stableNodes;
          return [
            element,
            element.querySelector(".journey-detail"),
            element.querySelector("[data-intermediate-stops] .trip-call"),
            element.querySelector(".stop-map-link"),
          ].every((node, i) => node === previous[i]);
        }),
      ).toBe(true);
    }
    await first.locator("[data-trip-open]").click();
    const dialog = page.locator("[data-trip-dialog]");
    await expect(dialog.locator(".vehicle-map")).toHaveCount(0);
    await expect(dialog.locator(".trip-call")).toHaveCount(3);
    await page.waitForTimeout(300);
    const geometry = await dialog.evaluate((element) => {
      element.scrollTop = 120;
      (window as any).stableDialogNodes = [
        element.querySelector(".trip-call"),
        element.querySelector("#trip-title"),
      ];
      return {
        height: element.getBoundingClientRect().height,
        scroll: element.scrollTop,
        total: element.scrollHeight,
      };
    });
    for (const delay of [null, 180, 0]) {
      push(delay);
      if (delay === 180)
        await expect(dialog.locator("[data-delay-badge]")).toHaveText(
          "Zpoždění 3 min",
        );
      else await expect(dialog.locator("[data-delay-badge]")).toHaveCount(0);
      if (delay === null)
        await expect(dialog.locator("[data-vehicle-map]")).toHaveCount(0);
      await page.waitForTimeout(250);
      const after = await dialog.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        scroll: element.scrollTop,
        total: element.scrollHeight,
        same: [
          element.querySelector(".trip-call"),
          element.querySelector("#trip-title"),
        ].every((node, i) => node === (window as any).stableDialogNodes[i]),
      }));
      expect(after.same).toBe(true);
      expect(Math.abs(after.height - geometry.height)).toBeLessThan(2);
      expect(Math.abs(after.scroll - geometry.scroll)).toBeLessThan(2);
      expect(Math.abs(after.total - geometry.total)).toBeLessThan(2);
    }
    expect(searches).toBe(1);
    expect(trips).toBe(1);
  });
}

test("multiple expanded journeys use local state and dialogs reuse static details", async ({
  page,
}) => {
  let detailRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/transport/trip/")) detailRequests++;
  });
  await page.goto(`/spojeni/?${query()}`);
  const cards = page.locator(".journey-card");
  await expect(cards).toHaveCount(2);
  await cards.first().locator(".journey-summary").click();
  await cards.last().locator(".journey-summary").click();
  await expect(
    page.locator(".journey-card.is-open .journey-detail"),
  ).toHaveCount(2);
  await expect(page.locator(".journey-risk-slot, .leg-info")).toHaveCount(0);
  expect(
    await cards.first().evaluate((el) => el.firstElementChild?.className),
  ).toBe("journey-summary");
  await expect(
    cards.first().locator(".journey-summary > .journey-summary-footer"),
  ).toBeVisible();
  const before = page.url();
  const historyLength = await page.evaluate(() => history.length);
  await expect(
    page.locator(".journey-card.is-open .journey-detail"),
  ).toHaveCount(2);
  await cards.first().locator("[data-trip-open]").first().click();
  const dialog = page.locator("[data-trip-dialog]");
  await expect(dialog.locator(".trip-call")).toHaveCount(3);
  await expect(
    dialog.locator(".trip-sticky-header [data-delay-badge]"),
  ).toHaveCount(0);
  await expect(
    dialog.locator(".vehicle-map, .vehicle-tracking, .trip-timeline-hint"),
  ).toHaveCount(0);
  const count = detailRequests;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await expect(dialog.locator(".trip-call")).toHaveCount(0);
  await cards.first().locator("[data-trip-open]").first().click();
  await expect(dialog.locator(".trip-call")).toHaveCount(3);
  expect(detailRequests).toBe(count);
  await page.keyboard.press("Escape");
  await cards.last().locator(".journey-summary").click();
  await expect(cards.last().locator(".journey-detail")).toHaveCount(0);
  await expect(cards.first().locator(".journey-detail")).toBeVisible();
  await cards.last().locator(".journey-summary").click();
  await expect(
    page.locator(".journey-card.is-open .journey-detail"),
  ).toHaveCount(2);
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.reload();
  await expect(page.locator(".journey-card.is-open")).toHaveCount(0);
});

test("terminal stop displays arrival while intermediate stops display departure", async ({
  page,
}) => {
  await page.route("**/api/transport/search/**", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const leg = json.data.journeys[0].legs[0];
    leg.to = { ...leg.to, id: id("S3"), name: "Praha, Národní třída" };
    leg.scheduledArrival = "2026-10-06T10:10:00+02:00";
    leg.expectedDeparture = null;
    leg.expectedArrival = null;
    leg.realtime = false;
    await route.fulfill({ json });
  });
  await page.route("**/api/transport/trip/**", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const calls = json.data.stops;
    calls[1].arrival = "2026-10-06T10:05:00+02:00";
    calls[1].departure = "2026-10-06T10:06:00+02:00";
    calls[2].arrival = "2026-10-06T10:10:00+02:00";
    calls[2].departure = "2026-10-06T10:22:00+02:00";
    await route.fulfill({ json });
  });
  await page.goto(`/spojeni/?${query()}`);
  await page.locator("[data-summary-trip]").first().click();
  const rows = page.locator("[data-trip-dialog] .trip-call");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1).locator("time")).toHaveText("10:06");
  await expect(rows.last().locator("time")).toHaveText("10:10");
  await page.locator("[data-close-trip]").click();
  await page.locator(".journey-summary").first().click();
  await page.locator(".intermediate-toggle").first().click();
  await expect(page.locator("[data-intermediate-stops] time")).toHaveText(
    "10:06",
  );
});

test("last-known GPS initialises the timeline and reopening redeems a new single-use ticket", async ({
  page,
}) => {
  const issued = new Map<string, string>();
  const redeemed = new Set<string>();
  let requests = 0;
  await page.route("**/api/transport/tracking/", async (route) => {
    const trip = route.request().postDataJSON().id;
    const ticket = `one-use-${++requests}`;
    issued.set(ticket, trip);
    await route.fulfill({
      json: {
        success: true,
        data: {
          status: "available",
          url: "ws://localhost:4328/last-known-test",
          ticket,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        },
      },
    });
  });
  await page.routeWebSocket("ws://localhost:4328/last-known-test", (socket) => {
    socket.onMessage((message) => {
      const request = JSON.parse(String(message));
      if (request.type !== "subscribe") return;
      expect(redeemed.has(request.ticket)).toBe(false);
      redeemed.add(request.ticket);
      const now = Date.now();
      socket.send(
        JSON.stringify({
          type: "observation",
          trip: issued.get(request.ticket),
          data: {
            status: "last_known",
            position: { lat: 50.0775, lon: 14.4255 },
            observed_at: new Date(now - 45000).toISOString(),
            valid_until: new Date(now + 45000).toISOString(),
            delay_seconds: null,
            cancelled: null,
          },
        }),
      );
    });
  });
  let details = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/transport/trip/")) details++;
  });
  await page.goto(`/spojeni/?${query()}`);
  await page.locator("[data-summary-trip]").first().click();
  const dialog = page.locator("[data-trip-dialog]");
  const dot = dialog.locator("[data-trip-vehicle-dot]");
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute("data-retained", "true");
  await expect(dot).toHaveAttribute(
    "aria-label",
    /Poslední jednoznačná poloha/,
  );
  await expect(dialog.locator(".trip-call")).toHaveCount(3);
  await expect(dialog.locator("[data-delay-badge]")).toHaveCount(0);
  const loaded = details;
  await page.locator("[data-close-trip]").click();
  await expect(dialog).not.toBeVisible();
  await page.locator("[data-summary-trip]").first().click();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => redeemed.size).toBe(2);
  await expect(dot).toBeVisible();
  await expect(dot).toHaveAttribute("data-retained", "true");
  expect(details).toBe(loaded);
});
