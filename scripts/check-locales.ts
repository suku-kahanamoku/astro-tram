import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { locales, defaultLocale } from "../src/modules/LangModule/config";

function shape(value: unknown, path = ""): string[] {
  if (typeof value === "string") {
    assert.ok(value.trim(), `Empty translation: ${path}`);
    return [path];
  }
  assert.ok(value && typeof value === "object", `Invalid translation: ${path}`);
  return Object.entries(value)
    .flatMap(([key, child]) => shape(child, `${path}.${key}`))
    .sort();
}
const modules = new URL("../src/modules/", import.meta.url);
for (const module of readdirSync(modules)) {
  const folder = new URL(`${module}/locales/`, modules);
  if (!existsSync(folder)) continue;
  assert.deepEqual(
    readdirSync(folder).sort(),
    locales.map((code) => `${code}.json`).sort(),
    `${module}: missing or unexpected locale`,
  );
  const load = (locale: string) =>
    JSON.parse(readFileSync(new URL(`${locale}.json`, folder), "utf8"));
  const expected = shape(load(defaultLocale));
  for (const locale of locales)
    assert.deepEqual(shape(load(locale)), expected, `${module}: ${locale}`);
  console.log(`${module} translations: ${locales.join(", ")} OK`);
}
