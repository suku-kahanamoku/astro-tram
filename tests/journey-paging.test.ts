import { test } from "node:test";
import assert from "node:assert/strict";
import { collectJourneyPage } from "../src/modules/TransportModule/server/journeyPage";
import { adjacentJourneyPage } from "../src/modules/TransportCoreModule/providers/journeyPaging";
import { journeyIdentity } from "../src/modules/TransportCoreModule/providers/journeyIdentity";
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

for (const arrive of [false, true]) {
  test(`display order uses departure across midnight, offsets and delays (${arrive ? "arrival query" : "departure query"})`, async () => {
    const early = journey(1, 0),
      late = journey(2, 5);
    early.legs[0].scheduledDeparture = "2026-10-05T23:55:00+02:00";
    early.legs[0].scheduledArrival = "2026-10-06T02:00:00+02:00";
    early.legs[0].expectedDeparture = "2026-10-06T01:00:00+02:00";
    late.legs[0].scheduledDeparture = "2026-10-05T23:05:00+01:00";
    late.legs[0].scheduledArrival = "2026-10-06T01:15:00+02:00";
    const result = await collectJourneyPage(
      {
        ...searchBody({
          ...state,
          arrive,
          at: arrive
            ? "2026-10-06T03:00:00+02:00"
            : "2026-10-05T23:00:00+02:00",
        }),
      },
      async () => ({ journeys: [late, early], partial: true }),
    );
    assert.deepEqual(
      result.journeys.map((j) => j.key),
      ["1", "2"],
    );
  });
}

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

function walking(departure: number, key: string): Journey {
  const candidate = journey(0, 0);
  return {
    ...candidate,
    key,
    duration: 853,
    legs: [
      {
        ...candidate.legs[0],
        mode: "walk",
        tripId: null,
        line: "",
        scheduledDeparture: instant(departure),
        scheduledArrival: instant(departure + 853000),
        geometry: {
          type: "LineString",
          coordinates: [
            [14, 50],
            [14.01, 50.01],
          ],
        },
      },
    ],
  };
}

for (const arrive of [false, true]) {
  test(`one walking route is returned once without repeated queries (${arrive ? "arrival" : "departure"})`, async () => {
    let calls = 0;
    const candidates = Array.from({ length: 10 }, (_, i) =>
      walking(start + (arrive ? -853000 - i * 1000 : i * 1000), String(i)),
    );
    const result = await collectJourneyPage(
      searchBody({ ...state, arrive }),
      async () => {
        calls++;
        return { journeys: candidates, partial: false };
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(result.journeys, [candidates[0]]);
    assert.equal(result.partial, false);
  });
}

test("walking routes with genuinely different paths remain separate", async () => {
  const a = walking(start, "a"),
    b = walking(start, "b");
  b.legs[0].geometry!.coordinates = [
    [14, 50],
    [14.02, 50.02],
    [14.01, 50.01],
  ];
  const result = await collectJourneyPage(searchBody(state), async () => ({
    journeys: [a, b],
    partial: false,
  }));
  assert.equal(result.journeys.length, 2);
});

test("mixed pages discard pure walking after three transit options, fill ten transit results and keep cursor boundaries", async () => {
  let calls = 0;
  const result = await collectJourneyPage(searchBody(state), async (body) => {
    const cursor = Date.parse(String(body["from-date"]));
    if (calls) assert.equal(cursor, start + (calls - 1) * 300000 + 1000);
    const trip = journey(calls, calls * 5);
    calls++;
    return {
      journeys: [
        walking(cursor, `walk-${calls}`),
        trip,
        { ...trip, key: `duplicate-${calls}` },
      ],
      partial: false,
    };
  });
  assert.equal(calls, 10);
  assert.equal(result.journeys.length, 10);
  assert.equal(
    result.journeys.filter((j) => j.legs[0].mode === "walk").length,
    0,
  );
  assert.equal(result.journeys[0].legs[0].scheduledDeparture, instant(start));
});

for (const count of [0, 1, 2, 3, 10]) {
  test(`pure walking is fallback with ${count} distinct transit options`, async () => {
    const transit = Array.from({ length: count }, (_, i) => journey(i, i * 5));
    const result = await collectJourneyPage(searchBody(state), async () => ({
      journeys: [
        walking(start, "walk"),
        ...transit,
        ...transit.map((j) => ({ ...j, key: `duplicate-${j.key}` })),
      ],
      partial: true,
    }));
    assert.equal(
      result.journeys.some((j) => j.legs.every((l) => l.mode === "walk")),
      count < 3,
    );
    assert.equal(result.journeys.length, count + (count < 3 ? 1 : 0));
  });
}

test("same departures sort by earlier arrival, planned duration and fewer transfers, ignoring live predictions", async () => {
  const late = journey(1, 0),
    many = journey(2, 0),
    few = journey(3, 0);
  late.legs[0].scheduledArrival = instant(start + 3600000);
  many.transfers = 3;
  few.transfers = 1;
  few.legs[0].expectedDeparture = instant(start + 1200000);
  few.legs[0].expectedArrival = instant(start + 4800000);
  many.duration = 1;
  few.duration = 99999;
  const result = await collectJourneyPage(searchBody(state), async () => ({
    journeys: [late, many, few],
    partial: true,
  }));
  assert.deepEqual(
    result.journeys.map((j) => j.key),
    ["3", "2", "1"],
  );
});

test("secondary order is applied before the ten-result page limit", async () => {
  const candidates = Array.from({ length: 12 }, (_, i) => {
    const candidate = journey(i, 0);
    candidate.legs[0].scheduledArrival = instant(start + (i + 1) * 60000);
    return candidate;
  }).reverse();
  const result = await collectJourneyPage(searchBody(state), async () => ({
    journeys: [walking(start, "walk"), ...candidates],
    partial: false,
  }));
  assert.deepEqual(
    result.journeys.map((j) => j.key),
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  );
});

test("walking access and transfers remain part of transit journeys", async () => {
  const transit = Array.from({ length: 3 }, (_, i) => {
    const candidate = journey(i, 20 + i * 5);
    candidate.legs.unshift(walking(start, "walk").legs[0]);
    return candidate;
  });
  const result = await collectJourneyPage(searchBody(state), async () => ({
    journeys: [walking(start, "walk"), ...transit],
    partial: true,
  }));
  assert.equal(result.journeys.length, 3);
  assert.ok(
    result.journeys.every(
      (j) => j.legs[0].mode === "walk" && j.legs[1].mode === "tram",
    ),
  );
});

test("journey identity retains different vehicles, boarding stops and scheduled departures, ignoring live updates", () => {
  const a = journey(0, 0);
  const live = structuredClone(a);
  live.key = "new-provider-key";
  live.legs[0].delaySeconds = 300;
  live.legs[0].expectedDeparture = instant(start + 300000);
  assert.equal(journeyIdentity(a), journeyIdentity(live));
  for (const changed of [journey(1, 0), journey(0, 5)])
    assert.notEqual(journeyIdentity(a), journeyIdentity(changed));
  const boarding = structuredClone(a);
  boarding.legs[0].from.id = "different-stop";
  assert.notEqual(journeyIdentity(a), journeyIdentity(boarding));
});
