import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TripObservationStatus from "../src/modules/TransportJourneyModule/components/TripObservationStatus";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import type {
  Leg,
  TripObservation,
} from "../src/modules/TransportCoreModule/types";

const leg = { tripId: "trip", mode: "train", realtime: false } as Leg;
const render = (live: TripObservation) =>
  renderToStaticMarkup(
    createElement(TripObservationStatus, { leg, live, t: dictionary("cs") }),
  );
const sample = (delaySeconds: number | null): TripObservation => ({
  status: delaySeconds === null ? "unavailable" : "live",
  position: null,
  delaySeconds,
  cancelled: null,
  observedAt: new Date().toISOString(),
  validUntil: new Date(Date.now() + 30000).toISOString(),
  responseState: "received",
});
test("receipt of an unavailable response never confirms an on-time service", () => {
  const html = render(sample(null));
  assert.match(html, /data-response-state="received"/);
  assert.doesNotMatch(html, /Bez zpoždění|data-delay-badge|data-delay-status/);
});
test("only a confirmed positive delay is displayed; zero delay has no label", () => {
  assert.doesNotMatch(
    render(sample(0)),
    /Bez zpoždění|data-delay-badge|data-delay-status/,
  );
  const delayed = render(sample(480));
  assert.match(delayed, /data-delay-badge="true"/);
  assert.match(delayed, /Zpoždění 8 min/);
});
