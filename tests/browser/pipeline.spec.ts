import { test, expect } from "@playwright/test";

test("header controls remain visible on mobile and require administrator login", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  const header = page.locator(".header-actions");
  await expect(
    header.getByRole("button", { name: "Sync", exact: true }),
  ).toBeEnabled();
  await expect(
    header.getByRole("button", { name: "Deploy", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("link", { name: "Najít spojení", exact: true }),
  ).toHaveCount(0);
  await header.getByRole("button", { name: "Sync", exact: true }).click();
  await expect(header.getByRole("status")).toContainText(
    "přihlas jako administrátor",
  );
  await page.screenshot({ path: testInfo.outputPath("pipeline-mobile.png") });
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width && rect.right > window.innerWidth + 1;
      })
      .slice(0, 12)
      .map((el) => ({
        tag: el.tagName,
        class: el.className,
        width: el.getBoundingClientRect().width,
        right: el.getBoundingClientRect().right,
      })),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    JSON.stringify(overflow),
  ).toBe(true);
  await header.getByRole("link", { name: "Přihlásit se" }).click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("admin login queues sync and deploy through PHP; receipt and polling show completion", async ({
  page,
}) => {
  await page.goto("/prihlaseni/");
  await page.locator('input[name="email"]').fill("admin@example.test");
  await page.locator('input[name="password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page.locator(".auth-card")).toContainText("admin@example.test");
  for (const action of ["Sync", "Deploy"]) {
    const controls = page.locator(".pipeline-controls");
    const button = controls.getByRole("button", { name: action, exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(controls.getByRole("status")).toContainText(
      "Čeká na spuštění",
    );
    await expect(
      controls.getByRole("button", { name: "Sync", exact: true }),
    ).toBeDisabled();
    await expect(
      controls.getByRole("button", { name: "Deploy", exact: true }),
    ).toBeDisabled();
    await expect(controls.getByRole("status")).toContainText("Hotovo", {
      timeout: 15000,
    });
  }
});

test("admin mutation rejects cross origin, extra fields and non-admin sessions", async ({
  request,
}) => {
  const endpoint = "/api/admin/local-pipeline/";
  expect(
    (
      await request.post("/api/auth/login/", {
        form: { email: "admin@example.test", password: "fixture-password" },
        headers: { Origin: "https://evil.test" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(endpoint, {
        data: { action: "deploy" },
        headers: { Origin: "https://evil.test" },
      })
    ).status(),
  ).toBe(403);
  const adminHeaders = {
    Origin: "http://localhost:4328",
    Cookie: `scaffold_session=${"a".repeat(64)}`,
  };
  expect(
    (
      await request.post(endpoint, {
        data: { action: "deploy", command: "x" },
        headers: adminHeaders,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.post(endpoint, {
        data: { action: ["deploy"] },
        headers: adminHeaders,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await request.post(endpoint, {
        data: { action: "deploy" },
        headers: {
          ...adminHeaders,
          Cookie: `scaffold_session=${"b".repeat(64)}`,
        },
      })
    ).status(),
  ).toBe(403);
  const status = await request.get(endpoint, { headers: adminHeaders });
  expect(status.headers()["cache-control"]).toContain("no-store");
  expect(await status.text()).not.toContain("test-only-secret");
});

test("queue feedback explains an offline runner and specific local failures", async ({
  page,
}) => {
  let state = "queued";
  let phase = "waiting_for_runner";
  await page.route("**/api/admin/local-pipeline/", (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          id: "00000000-0000-0000-0000-000000000001",
          action: "sync_build",
          status: state,
          phase,
          runner: { online: false },
        },
      },
    }),
  );
  await page.goto("/");
  const controls = page.locator(".pipeline-controls");
  await expect(controls.getByRole("status")).toContainText(
    "Lokální stroj není připojený",
  );
  await expect(
    controls.getByRole("button", { name: "Sync", exact: true }),
  ).toBeDisabled();
  state = "failed";
  phase = "local_memory_insufficient";
  await page.reload();
  await expect(controls.getByRole("status")).toContainText(
    "není dostatek volné RAM",
  );
  await expect(
    controls.getByRole("button", { name: "Deploy", exact: true }),
  ).toBeEnabled();
  phase = "runner_disconnected";
  await page.reload();
  await expect(controls.getByRole("status")).toContainText(
    "Lokální runner přestal odpovídat",
  );
  phase = "maven_failed";
  await page.reload();
  await expect(controls.getByRole("status")).toContainText(
    "Kompilace nebo testy Java aplikace selhaly",
  );
  phase = "runner_error";
  await page.reload();
  await expect(controls.getByRole("status")).toContainText(
    "Podrobnosti jsou v lokálním záznamu chyb",
  );
  phase = "local_otp_restore_failed";
  await page.reload();
  await expect(controls.getByRole("status")).toContainText(
    "Runner bude jejich obnovení opakovat",
  );
});
