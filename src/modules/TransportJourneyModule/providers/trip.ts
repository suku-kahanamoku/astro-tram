import type { Leg, Trip, TripStop } from "../../TransportCoreModule/types";
/** Match stop IDs and scheduled instants, not names: loops may visit the same stop twice. */
export function tripSegment(
  trip: Trip,
  leg: Leg,
): { from: number; to: number } | null {
  if (!leg.from.id || !leg.to.id) return null;
  const starts = trip.stops.flatMap((c, i) =>
    c.stop.id === leg.from.id ? [i] : [],
  );
  const ends = trip.stops.flatMap((c, i) =>
    c.stop.id === leg.to.id ? [i] : [],
  );
  const pairs = starts.flatMap((from) =>
    ends.filter((to) => to > from).map((to) => ({ from, to })),
  );
  const timed = pairs.filter(({ from, to }) => {
    const a = trip.stops[from],
      b = trip.stops[to];
    return (
      Date.parse(a.departure ?? a.arrival ?? "") ===
        Date.parse(leg.scheduledDeparture) &&
      Date.parse(b.arrival ?? b.departure ?? "") ===
        Date.parse(leg.scheduledArrival)
    );
  });
  const match =
    timed.length === 1 ? timed[0] : pairs.length === 1 ? pairs[0] : null;
  return match;
}

export function intermediateStops(trip: Trip, leg: Leg): TripStop[] | null {
  const match = tripSegment(trip, leg);
  return match ? trip.stops.slice(match.from + 1, match.to) : null;
}
