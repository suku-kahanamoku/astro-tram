import { defineConfig, envField } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { locales, pages, publicPages, url } from "./src/config/routes";
import { withStaticPageHeaders } from "./scripts/static-page-headers";

const env = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  "PUBLIC_",
);
const site =
  process.env.PUBLIC_SITE_URL || env.PUBLIC_SITE_URL || "http://localhost:4321";
// Keep browser tests and builds from invalidating a running dev server's
// optimized imports (especially lazily loaded OpenLayers).
const cacheScope =
  process.env.TRAM_BROWSER_TEST === "1"
    ? "browser-tests"
    : process.env.NODE_ENV === "production"
      ? "build"
      : "dev";
export default defineConfig({
  cacheDir: `./.astro/cache/${cacheScope}`,
  site,
  output: "server",
  devToolbar: { enabled: false },
  adapter: withStaticPageHeaders(
    process.env.NETLIFY === "true"
      ? netlify()
      : node({ mode: "standalone", staticHeaders: true }),
    process.env.NETLIFY === "true",
  ),
  server: { port: 4321 },
  build: { redirects: false },
  trailingSlash: "always",
  // Netlify handles aliases at the CDN; Node retains the query-aware middleware.
  redirects:
    process.env.NETLIFY === "true"
      ? Object.fromEntries(
          locales.flatMap((locale) =>
            pages.flatMap((page) => {
              const alias = `${url(locale)}${page === "home" ? "" : `${page}/`}`;
              const destination = url(locale, page);
              return alias === destination
                ? []
                : [[alias, { destination, status: 308 }]];
            }),
          ),
        )
      : {},
  i18n: {
    defaultLocale: "cs",
    locales: [...locales],
    routing: { prefixDefaultLocale: false },
  },
  env: {
    schema: {
      JAVA_TRAM_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      JAVA_TRAM_SERVICE_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PHP_CORE_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PHP_CORE_API_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      PHP_CORE_TENANT_HOST: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  integrations: [
    react(),
    sitemap({
      customPages: locales.flatMap((locale) =>
        publicPages.map((page) => new URL(url(locale, page), site).href),
      ),
      filter: (value) =>
        locales.some((locale) =>
          publicPages.some(
            (page) => new URL(url(locale, page), site).href === value,
          ),
        ),
    }),
  ],
  vite: {
    cacheDir: `./node_modules/.vite/${cacheScope}`,
    plugins: [tailwindcss()],
    ssr: {
      // Its ESM .js export lacks package type: module. Bundle it so Node
      // does not load it as CommonJS in the Netlify function.
      noExternal: ["react-datepicker"],
    },
  },
});
