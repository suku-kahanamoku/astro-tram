import type { Trip, TripObservation } from "../../TransportCoreModule/types";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";
import { validCoordinates } from "../../TransportCoreModule/providers/state";
import { timetableTripProgress } from "./timetableProgress";

export interface TripProgress {
  from: number;
  to: number;
  fraction: number;
  atStop: boolean;
}
/** Collapse verified stop progress onto a schematic axis with two visible endpoints. */
export function compactTripProgress(
  progress: TripProgress | null,
  segment: { from: number; to: number } | null,
): TripProgress | null {
  if (!progress || !segment || segment.to <= segment.from) return null;
  const point =
    progress.from + (progress.to - progress.from) * progress.fraction;
  if (point < segment.from || point > segment.to) return null;
  const fraction = (point - segment.from) / (segment.to - segment.from);
  return { from: 0, to: 1, fraction, atStop: progress.atStop };
}

/** Place verified progress against visible rows, marking vehicles outside the selected leg. */
export function legTimelineProgress(
  progress: TripProgress | null,
  segment: { from: number; to: number } | null,
  expanded: boolean,
): { progress: TripProgress; outside?: "before" | "after" } | null {
  if (!progress || !segment || segment.to <= segment.from) return null;
  const point =
    progress.from + (progress.to - progress.from) * progress.fraction;
  const outside =
    point < segment.from ? "before" : point > segment.to ? "after" : undefined;
  if (outside) {
    const index =
      outside === "before"
        ? expanded
          ? segment.from
          : 0
        : expanded
          ? segment.to
          : 1;
    return {
      progress: { from: index, to: index, fraction: 0, atStop: true },
      outside,
    };
  }
  return {
    progress: expanded ? progress : compactTripProgress(progress, segment)!,
  };
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
    !live ||
    (live?.positionSample?.status ?? live?.status) !== "live" ||
    !live.position ||
    !live.observedAt ||
    !live.validUntil ||
    live.cancelled === true
  )
    return false;
  const observed = Date.parse(
      live.positionSample?.observedAt ?? live.observedAt,
    ),
    until = Date.parse(live.positionSample?.validUntil ?? live.validUntil);
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

/** Schematic placement from measured GPS only, independent of timetable predictions. */
export function tripProgress(
  trip: Trip,
  live?: TripObservation,
  now = Date.now(),
): TripProgress | null {
  if (!freshTripPosition(live, now)) return null;
  return projectPosition(trip, live.position);
}

/** Backend progress is distinct from GPS and must match the displayed stop occurrences. */
export function estimatedTripProgress(
  trip: Trip,
  live?: TripObservation,
  now = Date.now(),
): TripProgress | null {
  const estimate = live?.estimatedProgress;
  if (
    !estimate ||
    live?.cancelled === true ||
    !["estimated", "live"].includes(live.status) ||
    Date.parse(estimate.observedAt) > now + config.gpsFutureToleranceMs ||
    Date.parse(estimate.observedAt) + config.gpsMaxAgeMs <= now ||
    Date.parse(estimate.validUntil) <= now
  )
    return null;
  const from = trip.stops[estimate.fromIndex],
    to = trip.stops[estimate.toIndex];
  if (
    !from ||
    !to ||
    from.stop.id !== estimate.fromStopId ||
    to.stop.id !== estimate.toStopId ||
    Date.parse(from.departure ?? "") !== Date.parse(estimate.fromDeparture) ||
    Date.parse(to.arrival ?? "") !== Date.parse(estimate.toArrival)
  )
    return null;
  return {
    from: estimate.fromIndex,
    to: estimate.toIndex,
    fraction: estimate.fraction,
    atStop: estimate.atStop,
  };
}

/** Previously measured GPS is explicitly last-known, never a live observation. */
export function lastKnownTripProgress(
  trip: Trip,
  live?: TripObservation,
  now = Date.now(),
): TripProgress | null {
  if (
    !live ||
    (live?.positionSample?.status ?? live?.status) !== "last_known" ||
    !live.position ||
    !live.observedAt ||
    !live.validUntil ||
    live.cancelled === true
  )
    return null;
  const observed = Date.parse(
      live.positionSample?.observedAt ?? live.observedAt,
    ),
    until = Date.parse(live.positionSample?.validUntil ?? live.validUntil);
  if (
    !Number.isFinite(observed) ||
    !Number.isFinite(until) ||
    observed > now + config.gpsFutureToleranceMs ||
    now - observed >= config.lastKnownGpsMaxAgeMs ||
    until <= now ||
    until > observed + config.lastKnownGpsMaxAgeMs ||
    !validCoordinates(live.position.lat, live.position.lon)
  )
    return null;
  return projectPosition(trip, live.position);
}

/** Measured positions take priority; a timetable prediction keeps the axis populated. */
export function displayTripProgress(
  trip: Trip,
  live?: TripObservation,
  remembered: TripProgress | null = null,
  now = Date.now(),
) {
  const current = tripProgress(trip, live, now);
  const known = lastKnownTripProgress(trip, live, now) ?? remembered;
  const backendEstimate = estimatedTripProgress(trip, live, now);
  const timetable = !current && !known && !backendEstimate;
  return {
    progress:
      current ?? known ?? backendEstimate ?? timetableTripProgress(trip, now),
    retained: !current && !!known,
    estimated: !current && !known,
    timetable,
  };
}

function projectPosition(
  trip: Trip,
  position: { lat: number; lon: number },
): TripProgress | null {
  const policy = config.timeline;
  // Local tangent plane centred on the measured point; wrap longitude at the date line.
  const points = trip.stops.map(({ stop }) => {
    if (
      stop.lat === null ||
      stop.lon === null ||
      !validCoordinates(stop.lat, stop.lon)
    )
      return null;
    const longitude = ((stop.lon - position.lon + 540) % 360) - 180;
    return {
      x: 6371000 * longitude * radians * Math.cos(position.lat * radians),
      y: 6371000 * (stop.lat - position.lat) * radians,
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
