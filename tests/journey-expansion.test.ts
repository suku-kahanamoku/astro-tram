import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandedJourneys,
  toggleJourney,
  journeyContext,
} from "../src/modules/TransportModule/providers/journeyExpansion";
import { navHref } from "../src/modules/TransportModule/providers/render";
test("journey expansion preserves other cards, legacy links and dialog context", () => {
  const original = new URL("https://tram.test/spojeni/?journey=a&stops=1");
  assert.deepEqual([...expandedJourneys(original)], ["a"]);
  const two = new URL(
    navHref(original, toggleJourney(original, "b")),
    original,
  );
  assert.deepEqual([...expandedJourneys(two)], ["a", "b"]);
  const context = journeyContext(two, "a");
  assert.equal(context.searchParams.get("journey"), "a");
  assert.deepEqual([...expandedJourneys(context)], ["a", "b"]);
  const closed = new URL(
    navHref(context, toggleJourney(context, "a")),
    original,
  );
  assert.deepEqual([...expandedJourneys(closed)], ["b"]);
  assert.equal(closed.searchParams.get("journey"), "b");
  assert.equal(closed.searchParams.has("stops"), false);
});
