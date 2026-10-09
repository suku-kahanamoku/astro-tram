import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLongitude,
  routeSegments,
  validMapCoordinates,
} from "../src/modules/OSMModule/providers/coordinates";

test("OSM geometry never bridges an invalid or missing point", () => {
  assert.deepEqual(
    routeSegments([
      [14.4, 50.1],
      [14.5, 50.2],
      [NaN, 50.3],
      [14.7, 50.4],
      [14.8, 50.5],
      [15, 91],
      [15.1, 50.6],
    ]),
    [
      [
        [14.4, 50.1],
        [14.5, 50.2],
      ],
      [
        [14.7, 50.4],
        [14.8, 50.5],
      ],
    ],
  );
  assert.deepEqual(routeSegments([[14, 50], [], [15, 51]]), []);
});

test("OSM coordinates reject nonfinite values and normalize clicks across world copies", () => {
  assert.equal(validMapCoordinates(0, 0), true);
  assert.equal(validMapCoordinates(null, 0), false);
  assert.equal(validMapCoordinates(50, Infinity), false);
  assert.equal(validMapCoordinates(91, 14), false);
  assert.ok(Math.abs(normalizeLongitude(374.42) - 14.42) < 1e-6);
  assert.equal(normalizeLongitude(-540), -180);
});
