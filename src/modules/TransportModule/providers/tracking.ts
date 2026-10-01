import type { TripObservation, Leg } from "../types";
import { validCoordinates, validInstant } from "./state";
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
  if (r.status !== "live")
    return unavailableObservation(
      ["unsupported", "disabled", "busy", "connecting", "stale"].includes(
        String(r.status),
      )
        ? String(r.status)
        : "unavailable",
    );
  const p = r.position as { lat?: unknown; lon?: unknown } | null;
  if (
    !validInstant(r.observed_at) ||
    !validInstant(r.valid_until) ||
    Date.parse(r.observed_at) > now + 5000 ||
    Date.parse(r.observed_at) + 30000 <= now ||
    Date.parse(r.valid_until) <= now ||
    Date.parse(r.valid_until) > Date.parse(r.observed_at) + 30000 ||
    !p ||
    typeof p.lat !== "number" ||
    typeof p.lon !== "number" ||
    !validCoordinates(p.lat, p.lon)
  )
    return unavailableObservation("stale");
  return {
    status: "live",
    position: { lat: p.lat, lon: p.lon },
    observedAt: r.observed_at,
    validUntil: r.valid_until,
    delaySeconds:
      typeof r.delay_seconds === "number" &&
      Number.isFinite(r.delay_seconds) &&
      Math.abs(r.delay_seconds) <= 86400
        ? r.delay_seconds
        : null,
    cancelled: typeof r.cancelled === "boolean" ? r.cancelled : null,
  };
}
export function delayMinutes(leg: Leg, live?: TripObservation): number {
  if (live?.status === "live" && live.delaySeconds !== null)
    return Math.max(0, Math.ceil(live.delaySeconds / 60));
  if (live && !["connecting", "unsupported", "disabled"].includes(live.status))
    return 0;
  if (
    !leg.realtime ||
    !leg.expectedDeparture ||
    !leg.predictionValidUntil ||
    Date.parse(leg.predictionValidUntil) <= Date.now()
  )
    return 0;
  return Math.max(
    0,
    Math.ceil(
      (Date.parse(leg.expectedDeparture) - Date.parse(leg.scheduledDeparture)) /
        60000,
    ),
  );
}
/** Current vehicle delay is an estimate for future alighting; never a guaranteed held connection. */
export function trackedLeg(leg: Leg, live?: TripObservation): Leg {
  if (
    !live ||
    live.status !== "live" ||
    live.delaySeconds === null ||
    leg.mode === "walk"
  )
    return leg;
  const shift = (time: string) =>
    new Date(Date.parse(time) + live.delaySeconds! * 1000).toISOString();
  return {
    ...leg,
    expectedDeparture: shift(leg.scheduledDeparture),
    expectedArrival: shift(leg.scheduledArrival),
    realtime: true,
    arrivalEstimated: true,
    cancelled: live.cancelled === true,
  };
}
export function transferAtRisk(legs: Leg[]): boolean {
  let ready: number | undefined;
  let transit = false;
  for (const l of legs) {
    if (l.cancelled) return true;
    const dep = Date.parse(l.expectedDeparture ?? l.scheduledDeparture),
      arr = Date.parse(l.expectedArrival ?? l.scheduledArrival);
    if (l.mode === "walk") {
      ready = Math.max(ready ?? dep, dep) + Math.max(0, arr - dep);
      transit = false;
    } else {
      if (ready !== undefined && dep < ready + (transit ? 60000 : 0))
        return true;
      ready = arr;
      transit = true;
    }
  }
  return false;
}
