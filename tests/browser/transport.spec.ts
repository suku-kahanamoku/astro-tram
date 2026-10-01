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
test("landing, autocomplete, direct search, detail, reload and history", async ({
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
  await expect(page).toHaveURL(/journey=/);
  await expect(page.locator(".journey-detail")).toBeVisible();
  const detail = page.url();
  await page.reload();
  await expect(page.locator(".journey-detail")).toBeVisible();
  expect(page.url()).toBe(detail);
  await page
    .getByRole("link", { name: "Zastávky spoje 22", exact: true })
    .click();
  await expect(page).toHaveURL(/leg=0/);
  await expect(page.locator(".trip-stops li")).toHaveCount(3);
  await page.goBack();
  await expect(page.locator("[data-trip-dialog]")).not.toBeVisible();
  await page.goForward();
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
test("map picker and route map are URL navigations with refresh and Escape", async ({
  page,
}) => {
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("**/tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator('[data-map="from"]')).toBeDisabled();
  await expect(page.locator('[data-map="to"]')).toBeDisabled();
  await page.goto(
    "/?fromKind=coordinates&fromLat=50.07&fromLon=14.42&fromLabel=Vybrany+bod",
  );
  await page.getByRole("button", { name: "Vybrat na mapě – Odkud" }).click();
  await expect(page).toHaveURL(/map=from/);
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
  await page.reload();
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
  await expect(page.locator("[data-nearest-stop=from]")).toContainText(
    "Praha, Muzeum",
  );
  expect(page.url()).not.toContain("50.08");
  expect(page.url()).not.toContain("observed");
  await context.setGeolocation({ latitude: 50.09, longitude: 14.42 });
  await page.reload();
  await expect(page.locator(".journey-card")).toHaveCount(2);
  expect(body["from-dest"].lat).toBe(50.09);
  await expect(page.locator("[data-nearest-stop=from]")).toContainText(
    "Praha, Vltavská",
  );
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
test("public boundary rejects foreign origins and exposes no upstream secrets", async ({
  request,
}) => {
  const response = await request.post("/api/transport/search/", {
    headers: { Origin: "https://evil.test" },
    data: {},
  });
  expect(response.status()).toBe(403);
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
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (ok: PositionCallback) => {
          (window as any).finishGps = () =>
            ok({
              timestamp: Date.now(),
              coords: { latitude: 50.08, longitude: 14.41 },
            } as GeolocationPosition);
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

test("GPS scope uses a fresh fix in POST only and explicit city takes priority", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.195, longitude: 16.61 });
  await page.goto("/");
  await page.locator("[data-scope-location]").check();
  const pending = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
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
  const explicit = page.waitForRequest((r) =>
    r.url().includes("/api/transport/places/"),
  );
  await page.locator("#place-from").fill("Muzeum");
  const explicitRequest = await explicit;
  expect(explicitRequest.method()).toBe("GET");
  expect(
    JSON.parse(new URL(explicitRequest.url()).searchParams.get("q")!),
  ).toEqual({ name: { $regex: "Muzeum" }, city: "Praha", state: "CZ" });
});

test("city picker defaults to all and offers online municipalities", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.locator("#travel-city")).toHaveValue("Všechny jízdní řády");
  await page.locator("#travel-city").click();
  await expect(
    page
      .locator("#city-options")
      .getByRole("option", { name: "Brno", exact: true }),
  ).toBeVisible();
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

test("line opens full-trip dialog; middle button shows only intermediate stops; URL survives reload", async ({
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
  await page.reload();
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(map.locator("h2")).toHaveText("Pouze mezilehlá");
  await page.keyboard.press("Escape");
  await expect(map).not.toBeVisible();
  await expect(middleStop).toBeFocused();
  await expect(page).toHaveURL(/stops=0/);
  await page.reload();
  await expect(list).toContainText("Pouze mezilehlá");
  await expect(dialog).not.toBeVisible();
});

test("stop map fetches missing coordinates; read-only marker survives refresh and failures show no invented location", async ({
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
  await expect(page).toHaveURL(/map=stop/);
  await page.reload();
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
  await expect(page.locator('[data-map="from"]')).toBeDisabled();
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
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/trip/"),
  );
  await page.locator('[data-trip-open="0"]').click();
  const payload = await (await response).json();
  expect(JSON.stringify(payload)).not.toContain("DO_NOT_EXPOSE");
  expect(payload.data.metadata.vehicle_position).toBeUndefined();
  const legend = page.locator("[data-trip-legend]");
  await expect(legend).toContainText("22/1093");
  const notes = page.locator("[data-trip-notes]");
  await expect(notes).toContainText("Testovací dopravce");
  await expect(notes).toContainText(
    "Garantovaná návaznost dle testovacího jízdního řádu.",
  );
  await expect(
    notes.getByRole("link", { name: "www.example.test/tarif" }),
  ).toHaveAttribute("href", "https://www.example.test/tarif");
  await expect(legend.locator("svg")).toHaveCount(2);
  await expect(notes.locator("svg")).toHaveCount(3);
  await expect(legend).not.toContainText("Poznámka linky");
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
  await expect(legend).not.toContainText(routeName);
  await page.reload();
  await expect(legend).toContainText("22/1093");
  await expect(route).toHaveText(routeName);
  await page.keyboard.press("Escape");
  await page.route("**/api/transport/trip/**", (route) =>
    route.fulfill({
      status: 503,
      json: { success: false, error: "unavailable" },
    }),
  );
  await page.locator('[data-trip-open="0"]').click();
  await expect(page.locator("[data-trip-dialog-stops]")).toHaveText(
    "Podrobnosti spoje teď nejsou dostupné.",
  );
  await expect(legend).not.toBeVisible();
  await expect(legend).toBeEmpty();
  await expect(route).toHaveCount(0);
});

test("trip stop columns show tariff zone, request-stop explanation and source kilometrage on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/spojeni/?" + query());
  await page.locator(".journey-summary").first().click();
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/transport/trip/"),
  );
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
  await expect(dialog.locator(".request-stop")).toHaveCount(1);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(dialog.locator(".trip-stop-km").nth(2)).toContainText(
    "1,227 km",
  );
});

test("trip stop opens a map above the trip dialog with refresh, history, focus return and lookup failure", async ({
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
  await expect(page).toHaveURL(/tripStop=1/);
  expect(new URL(page.url()).searchParams.get("leg")).toBe("0");
  await page.reload();
  await expect(tripDialog).toBeVisible();
  await expect(map.locator("canvas").first()).toBeVisible();
  await expect(map.locator("h2")).toHaveText("Praha, Malostranská");
  await page.keyboard.press("Escape");
  await expect(map).not.toBeVisible();
  await expect(tripDialog).toBeVisible();
  await expect(stopLink).toBeFocused();
  await stopLink.press("Enter");
  await expect(map.locator("canvas").first()).toBeVisible();
  await page.goBack();
  await expect(map).not.toBeVisible();
  await expect(tripDialog).toBeVisible();
  await page.goForward();
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
