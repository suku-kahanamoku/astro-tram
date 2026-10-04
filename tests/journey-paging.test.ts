import { test } from "node:test";
import assert from "node:assert/strict";
import { collectJourneyPage } from "../src/modules/TransportModule/server/journeyPage";
import { adjacentJourneyPage } from "../src/modules/TransportCoreModule/providers/journeyPaging";
import {
  readState,
  writeState,
  searchBody,
} from "../src/modules/TransportCoreModule/providers/state";
import type {
  Journey,
  SearchState,
} from "../src/modules/TransportCoreModule/types";

const start = Date.parse("2026-10-05T22:00:00Z");
const instant = (ms: number) =>
  new Date(ms).toISOString().replace(".000Z", "Z");
function journey(index: number, minutes: number): Journey {
  return {
    key: String(index),
    duration: 900,
    transfers: 0,
    source: {
      provider: "fixture",
      mode: "schedule",
      limited: false,
      attribution: "fixture",
    },
    legs: [
      {
        mode: "tram",
        from: { id: "a", name: "A", lat: 50, lon: 14, platform: null },
        to: { id: "b", name: "B", lat: 50, lon: 14, platform: null },
        scheduledDeparture: instant(start + minutes * 60000),
        scheduledArrival: instant(start + (minutes + 15) * 60000),
        expectedDeparture: null,
        expectedArrival: null,
        realtime: false,
        cancelled: false,
        tripId: String(index),
        line: "1",
        operator: "",
        geometry: null,
      },
    ],
  };
}
const state: SearchState = {
  from: { type: "stop", id: "a", label: "A" },
  to: { type: "stop", id: "b", label: "B" },
  at: instant(start),
  arrive: false,
  direct: false,
  country: "CZ",
};

for (const spacing of [2, 75]) {
  test(`ten journeys per page across hourly windows, forward/backward (${spacing} minute headway)`, async () => {
    const timetable = Array.from({ length: 40 }, (_, i) =>
      journey(i, i * spacing),
    );
    const fetchBatch = async (body: Record<string, unknown>) => {
      const arrive = typeof body["to-date"] === "string";
      const at = Date.parse(String(body[arrive ? "to-date" : "from-date"]));
      const journeys = timetable.filter((j) => {
        const time = Date.parse(
          arrive ? j.legs[0].scheduledArrival : j.legs[0].scheduledDeparture,
        );
        const distance = (time - at) * (arrive ? -1 : 1);
        return distance >= 0 && distance < 3600000;
      });
      return { journeys, partial: false };
    };
    const first = await collectJourneyPage(searchBody(state), fetchBatch);
    assert.deepEqual(
      first.journeys.map((j) => j.key),
      timetable.slice(0, 10).map((j) => j.key),
    );
    const nextState = adjacentJourneyPage(state, first.journeys, "later");
    assert.deepEqual(readState(writeState(nextState)), nextState);
    const second = await collectJourneyPage(searchBody(nextState), fetchBatch);
    assert.deepEqual(
      second.journeys.map((j) => j.key),
      timetable.slice(10, 20).map((j) => j.key),
    );
    const previous = adjacentJourneyPage(nextState, second.journeys, "earlier");
    assert.equal(previous.arrive, state.arrive);
    const back = await collectJourneyPage(searchBody(previous), fetchBatch);
    assert.deepEqual(
      back.journeys.map((j) => j.key),
      first.journeys.map((j) => j.key),
    );
  });
}

test("later upstream failures preserve fetched journeys and mark the page partial", async () => {
  let calls = 0;
  const result = await collectJourneyPage(searchBody(state), async () => {
    if (++calls > 1) throw new Error("unavailable");
    return { journeys: [journey(0, 0)], partial: false };
  });
  assert.equal(result.journeys.length, 1);
  assert.equal(result.partial, true);
});

test("an empty timetable stops within the bounded scan and returns no invented records", async () => {
  let calls = 0;
  const result = await collectJourneyPage(searchBody(state), async () => {
    calls++;
    return { journeys: [], partial: false };
  });
  assert.equal(calls, 24);
  assert.equal(result.journeys.length, 0);
});
