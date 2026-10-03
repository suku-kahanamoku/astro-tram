import type {
  TripObservation,
  Leg,
  Journey,
  TripStop,
} from "../../TransportCoreModule/types";
import {
  validCoordinates,
  validInstant,
} from "../../TransportCoreModule/providers/state";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";
const trackingInstant = (value: unknown): value is string =>
  typeof value === "string" &&
  validInstant(value.replace(/\.\d{1,3}(?=Z|[+-])/, ""));
export const unavailableObservation = (
  status = "unavailable",
): TripObservation => ({
  status,
  position: null,
  observedAt: null,
  validUntil: null,
  delaySeconds: null,
  cancelled: null,
});
/** Validate at every boundary; expiry is measured from the source observation. */
export function observation(value: unknown, now = Date.now()): TripObservation {
  if (!value || typeof value !== "object") return unavailableObservation();
  const r = value as Record<string, unknown>;
  if (r.status !== "live" && r.status !== "last_known")
    return unavailableObservation(
      ["unsupported", "disabled", "busy", "connecting", "stale"].includes(
        String(r.status),
      )
        ? String(r.status)
        : "unavailable",
    );
  const p = r.position as { lat?: unknown; lon?: unknown } | null;
  const maxAge =
    r.status === "last_known"
      ? config.lastKnownGpsMaxAgeMs
      : config.gpsMaxAgeMs;
  if (
    !trackingInstant(r.observed_at) ||
    !trackingInstant(r.valid_until) ||
    Date.parse(r.observed_at) > now + 5000 ||
    Date.parse(r.observed_at) + maxAge <= now ||
    Date.parse(r.valid_until) <= now ||
    Date.parse(r.valid_until) < Date.parse(r.observed_at) ||
    Date.parse(r.valid_until) > Date.parse(r.observed_at) + maxAge
  )
    return unavailableObservation("stale");
  const position =
    p &&
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    validCoordinates(p.lat, p.lon)
      ? { lat: p.lat, lon: p.lon }
      : null;
  const delaySeconds =
    r.status === "live" &&
    typeof r.delay_seconds === "number" &&
    Number.isFinite(r.delay_seconds) &&
    Math.abs(r.delay_seconds) <= 86400
      ? r.delay_seconds
      : null;
  const cancelled =
    r.status === "live" && typeof r.cancelled === "boolean"
      ? r.cancelled
      : null;
  // A verified delay does not depend on a vehicle publishing its GPS.
  if (!position && delaySeconds === null && cancelled === null)
    return unavailableObservation("unavailable");
  return {
    status: r.status,
    position,
    observedAt: r.observed_at,
    validUntil: r.valid_until,
    delaySeconds,
    cancelled,
  };
}
export function knownDelayMinutes(
  leg: Leg,
  live?: TripObservation,
  now = Date.now(),
): number | null {
  // A missing GPS observation does not invalidate a separate fresh stop-time prediction.
  if (
    live?.status === "live" &&
    live.delaySeconds !== null &&
    Number.isFinite(live.delaySeconds) &&
    live.observedAt &&
    live.validUntil &&
    Date.parse(live.validUntil) > now &&
    Date.parse(live.observedAt) + 30000 > now &&
    Date.parse(live.observedAt) <= now + 5000
  )
    return Math.max(0, Math.ceil(live.delaySeconds / 60));
  if (
    !leg.realtime ||
    !leg.predictionValidUntil ||
    !Number.isFinite(Date.parse(leg.predictionValidUntil)) ||
    Date.parse(leg.predictionValidUntil) <= now
  )
    return null;
  if (typeof leg.delaySeconds === "number" && Number.isFinite(leg.delaySeconds))
    return Math.max(0, Math.ceil(leg.delaySeconds / 60));
  const delays = [
    [leg.expectedDeparture, leg.scheduledDeparture],
    [leg.expectedArrival, leg.scheduledArrival],
  ].flatMap(([expected, scheduled]) =>
    expected &&
    scheduled &&
    Number.isFinite(Date.parse(expected)) &&
    Number.isFinite(Date.parse(scheduled))
      ? [(Date.parse(expected) - Date.parse(scheduled)) / 60000]
      : [],
  );
  return delays.length ? Math.max(0, ...delays.map(Math.ceil)) : null;
}
/** Numeric convenience for calculations; presentation distinguishes null from zero. */
export function delayMinutes(
  leg: Leg,
  live?: TripObservation,
  now = Date.now(),
): number {
  return knownDelayMinutes(leg, live, now) ?? 0;
}
/** Predictions are ephemeral. Preserve scheduled fields for URLs and exact stop matching. */
export function trackedLeg(
  leg: Leg,
  live?: TripObservation,
  now = Date.now(),
): Leg {
  const expired =
    !!leg.predictionValidUntil && Date.parse(leg.predictionValidUntil) <= now;
  let result = expired
    ? {
        ...leg,
        expectedDeparture: null,
        expectedArrival: null,
        realtime: false,
        delaySeconds: null,
        arrivalEstimated: false,
      }
    : { ...leg };
  if (live?.status !== "live") return result;
  if (live.cancelled !== null) result.cancelled = live.cancelled;
  if (live.delaySeconds === null || leg.mode === "walk") return result;
  // Position delay estimates future calls only, not historical stop times.
  const observed = Date.parse(live.observedAt ?? "");
  const shift = (scheduled: string, prediction: string | null) => {
    const estimate = Date.parse(scheduled) + live.delaySeconds! * 1000;
    if (Number.isFinite(observed) && estimate < observed) return prediction;
    return new Date(estimate).toISOString();
  };
  result = {
    ...result,
    expectedDeparture: shift(leg.scheduledDeparture, result.expectedDeparture),
    expectedArrival: shift(leg.scheduledArrival, result.expectedArrival),
    realtime: true,
    arrivalEstimated: true,
    predictionValidUntil: live.validUntil,
  };
  return result;
}
/** Internal predictions assess transfers; UI timetable fields never consume them. */
export function trackedJourney(
  journey: Journey,
  observations: Record<string, TripObservation>,
  now = Date.now(),
): Journey & { transferRiskLegs: number[] } {
  let ready: number | undefined,
    previousTransit = false,
    risk = false;
  const transferRiskLegs: number[] = [];
  const legs = journey.legs.map((original, index) => {
    let leg = trackedLeg(
      original,
      original.tripId ? observations[original.tripId] : undefined,
      now,
    );
    const scheduledDuration =
      Date.parse(leg.scheduledArrival) - Date.parse(leg.scheduledDeparture);
    let dep = Date.parse(leg.expectedDeparture ?? leg.scheduledDeparture),
      arr = Date.parse(leg.expectedArrival ?? leg.scheduledArrival);
    if (leg.cancelled) risk = true;
    if (leg.mode === "walk" && ready !== undefined) {
      dep = Math.max(Date.parse(leg.scheduledDeparture), ready);
      arr = dep + scheduledDuration;
      const moved = dep !== Date.parse(leg.scheduledDeparture);
      leg = {
        ...leg,
        expectedDeparture: moved ? new Date(dep).toISOString() : null,
        expectedArrival: moved ? new Date(arr).toISOString() : null,
        realtime: moved,
        arrivalEstimated: moved,
      };
    } else if (
      ready !== undefined &&
      dep <
        ready + (leg.minTransferSeconds ?? (previousTransit ? 60 : 0)) * 1000
    ) {
      risk = true;
      transferRiskLegs.push(index);
    }
    ready = arr;
    previousTransit = leg.mode !== "walk";
    return leg;
  });
  const first = legs[0],
    last = legs.at(-1);
  const duration =
    first && last
      ? Math.max(
          0,
          (Date.parse(last.expectedArrival ?? last.scheduledArrival) -
            Date.parse(first.expectedDeparture ?? first.scheduledDeparture)) /
            1000,
        )
      : journey.duration;
  return { ...journey, legs, duration, transferAtRisk: risk, transferRiskLegs };
}
export function transferAtRisk(legs: Leg[]): boolean {
  return (
    trackedJourney({ legs, duration: 0 } as Journey, {}).transferAtRisk === true
  );
}
/** Individual call prediction wins; a vehicle delay only estimates future calls. */
export function callTime(
  call: TripStop,
  event: "arrival" | "departure",
  live?: TripObservation,
  now = Date.now(),
): { value: string | null; estimated: boolean } {
  const scheduled =
    call[event] ?? call[event === "arrival" ? "departure" : "arrival"];
  const predicted =
    event === "arrival" ? call.expectedArrival : call.expectedDeparture;
  if (
    predicted &&
    call.predictionValidUntil &&
    Date.parse(call.predictionValidUntil) > now
  )
    return { value: predicted, estimated: false };
  if (
    scheduled &&
    live?.status === "live" &&
    live.delaySeconds !== null &&
    live.observedAt
  ) {
    const value = Date.parse(scheduled) + live.delaySeconds * 1000;
    if (value >= Date.parse(live.observedAt))
      return { value: new Date(value).toISOString(), estimated: true };
  }
  return { value: scheduled, estimated: false };
}
