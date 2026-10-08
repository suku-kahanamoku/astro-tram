import { readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { locales, pages, url } from "../src/config/routes";

/** Both adapters currently preserve only CSP from prerendered responses. */
export function withStaticPageHeaders(
  adapter: AstroIntegration,
  netlify: boolean,
): AstroIntegration {
  return {
    ...adapter,
    hooks: {
      ...adapter.hooks,
      "astro:build:done": async (options) => {
        await adapter.hooks["astro:build:done"]?.(options);
        const entries = locales.flatMap((locale) =>
          pages.map((page) => ({
            pathname: [url(locale, page)],
            headers: [
              { key: "X-Content-Type-Options", value: "nosniff" },
              { key: "X-Frame-Options", value: "SAMEORIGIN" },
              {
                key: "Referrer-Policy",
                value:
                  page === "search"
                    ? "no-referrer"
                    : page === "login" || page === "account"
                      ? "same-origin"
                      : "strict-origin-when-cross-origin",
              },
              ...(["search", "login", "account"].includes(page)
                ? [{ key: "Cache-Control", value: "private, no-store" }]
                : []),
            ],
          })),
        );
        if (netlify) {
          await writeFile(
            new URL("_headers", options.dir),
            entries
              .map(
                ({ pathname, headers }) =>
                  `${pathname[0]}\n${headers.map(({ key, value }) => `  ${key}: ${value}`).join("\n")}\n`,
              )
              .join("\n"),
          );
        } else {
          const target = new URL("../_headers.json", options.dir);
          // Preserve any adapter-generated CSP alongside our page policies.
          const existing = JSON.parse(
            await readFile(target, "utf8").catch(() => "[]"),
          ) as typeof entries;
          for (const entry of entries) {
            const original = existing.find((value) =>
              value.pathname.includes(entry.pathname[0]),
            );
            entry.headers.push(
              ...(original?.headers.filter(
                ({ key }) =>
                  !entry.headers.some((header) => header.key === key),
              ) ?? []),
            );
          }
          await writeFile(target, JSON.stringify(entries));
        }
      },
    },
  };
}
