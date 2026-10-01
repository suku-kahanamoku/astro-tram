import test from "node:test";
import assert from "node:assert/strict";
import {
  locales,
  localeFromPath,
} from "../src/modules/LangModule/providers/locale";
import {
  pages,
  url,
  resolveRoute,
  legacyRedirect,
  routeDictionary,
} from "../src/config/routes";
test("all locale/page combinations round-trip through shared routes", () => {
  for (const locale of locales)
    for (const page of pages)
      assert.deepEqual(resolveRoute(url(locale, page)), { locale, page });
  assert.equal(url("cs"), "/");
  assert.equal(url("de", "account"), "/de/konto/");
});
test("unknown routes never render a home page with HTTP 200", () => {
  for (const path of [
    "/missing/",
    "/fr/",
    "/cs/",
    "/en/unknown/",
    "/o-nas/extra/",
  ])
    assert.equal(resolveRoute(path), null);
  assert.equal(localeFromPath("/en/unknown/"), "en");
});

test("localized slugs are unique and legacy URLs redirect once", () => {
  assert.equal(url("cs", "about"), "/o-nas/");
  assert.equal(url("de", "about"), "/de/ueber-uns/");
  for (const locale of locales) {
    assert.deepEqual(
      Object.keys(routeDictionary(locale).routes).sort(),
      [...pages].sort(),
    );
    const paths = pages.map((page) => url(locale, page));
    assert.equal(new Set(paths).size, pages.length);
    for (const page of pages) {
      const canonical = url(locale, page);
      const old = `${url(locale)}${page === "home" ? "" : `${page}/`}`;
      assert.equal(legacyRedirect(old), old === canonical ? null : canonical);
      assert.equal(legacyRedirect(canonical), null);
    }
  }
  for (const path of [
    "/api/auth/login/",
    "/unknown/",
    "/about/extra/",
    "//example.com/about/",
  ])
    assert.equal(legacyRedirect(path), null);
});
