import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:4328",
    browserName: "chromium",
    trace: "retain-on-failure",
    timezoneId: "Europe/Prague",
    locale: "cs-CZ",
  },
  webServer: [
    {
      command: "node tests/mock-core.mjs",
      url: "http://127.0.0.1:4399/health",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 4328 --ignore-lock",
      url: "http://localhost:4328",
      reuseExistingServer: false,
      env: {
        TRAM_BROWSER_TEST: "1",
        // A canonical URL with a different port must not block dev POST requests.
        PUBLIC_SITE_URL: "http://localhost:4321",
        JAVA_TRAM_URL: "http://127.0.0.1:4399",
        JAVA_TRAM_SERVICE_TOKEN: "test-only-java-service-token",
        PHP_CORE_URL: "http://127.0.0.1:4399",
        PHP_CORE_API_KEY: "test-only-secret",
        PHP_CORE_TENANT_HOST: "tram.test",
      },
    },
  ],
});
