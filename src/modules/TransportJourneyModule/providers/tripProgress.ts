import type { Trip, TripObservation } from "../../TransportCoreModule/types";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";
import { validCoordinates } from "../../TransportCoreModule/providers/state";

export interface TripProgress {
  from: number;
  to: number;
  fraction: number;
  atStop: boolean;
}
const radians = Math.PI / 180;
/** Whether an observation may still be displayed as live GPS. */
export function freshTripPosition(
  live?: TripObservation,
  now = Date.now(),
): live is TripObservation & {
  position: { lat: number; lon: number };
  observedAt: string;
  validUntil: string;
} {
  if (
    live?.status !== "live" ||
    !live.position ||
    !live.observedAt ||
    !live.validUntil ||
    live.cancelled === true
  )
    return false;
  const observed = Date.parse(live.observedAt),
    until = Date.parse(live.validUntil);
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(until) ||
    observed > now + config.gpsFutureToleranceMs ||
    now - observed >= config.gpsMaxAgeMs ||
    until <= now ||
    until > observed + config.gpsMaxAgeMs ||
    !validCoordinates(live.position.lat, live.position.lon)
  )
    return false;
  return true;
}

/** Schematic placement from measured GPS only. Timetable times never move the dot. */
export function tripProgress(
  trip: Trip,
  live?: TripObservation,
  now = Date.now(),
): TripProgress | null {
  if (!freshTripPosition(live, now)) return null;
  const policy = config.timeline;
  // Local tangent plane centred on the measured point; wrap longitude at the date line.
  const points = trip.stops.map(({ stop }) => {
    if (
      stop.lat === null ||
      stop.lon === null ||
      !validCoordinates(stop.lat, stop.lon)
    )
      return null;
    const longitude = ((stop.lon - live.position!.lon + 540) % 360) - 180;
    return {
      x: 6371000 * longitude * radians * Math.cos(live.position!.lat * radians),
      y: 6371000 * (stop.lat - live.position!.lat) * radians,
    };
  });
  const nearby = points.flatMap((point, index) =>
    point && Math.hypot(point.x, point.y) <= policy.atStopMeters ? [index] : [],
  );
  // Repeated stops/loops are ambiguous without an explicit upstream stop occurrence.
  if (nearby.length > 1) return null;
  if (nearby.length === 1)
    return { from: nearby[0], to: nearby[0], fraction: 0, atStop: true };
  const matches: { index: number; fraction: number; distance: number }[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index],
      b = points[index + 1];
    if (!a || !b) continue; // Never bridge a stop with missing coordinates.
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (length < policy.minSegmentMeters || length > policy.maxSegmentMeters)
      continue;
    const fraction = -(a.x * dx + a.y * dy) / (length * length);
    if (fraction <= 0 || fraction >= 1) continue;
    const distance = Math.hypot(a.x + dx * fraction, a.y + dy * fraction);
    if (distance <= Math.min(policy.maxOffsetMeters, length / 4))
      matches.push({ index, fraction, distance });
  }
  matches.sort((a, b) => a.distance - b.distance);
  const best = matches[0];
  if (!best) return null;
  if (
    matches
      .slice(1)
      .some(
        (other) =>
          other.distance <= best.distance + policy.ambiguityMeters &&
          Math.abs(other.index + other.fraction - best.index - best.fraction) >
            0.2,
      )
  )
    return null;
  return {
    from: best.index,
    to: best.index + 1,
    fraction: best.fraction,
    atStop: false,
  };
}
