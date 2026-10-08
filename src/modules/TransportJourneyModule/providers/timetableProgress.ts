import type { Trip } from "../../TransportCoreModule/types";
import type { TripProgress } from "./tripProgress";

/** A schematic timetable prediction only; never a GPS measurement or a delay. */
export function timetableTripProgress(
  trip: Trip,
  now = Date.now(),
): TripProgress | null {
  if (!trip.stops.length) return null;
  const at = (index: number): TripProgress => ({
    from: index,
    to: index,
    fraction: 0,
    atStop: true,
  });
  const instant = (value: string | null | undefined) => {
    const time = Date.parse(value ?? "");
    return Number.isFinite(time) ? time : null;
  };
  let previous = 0;
  let departed: number | null = null;
  for (let index = 0; index < trip.stops.length; index++) {
    const call = trip.stops[index];
    const arrival = instant(call.arrival) ?? instant(call.departure);
    const departure = instant(call.departure) ?? arrival;
    if (arrival !== null && now < arrival) {
      // Do not interpolate across missing or inconsistent timetable entries.
      if (departed !== null && index === previous + 1 && arrival > departed)
        return {
          from: previous,
          to: index,
          fraction: Math.max(
            0,
            Math.min(1, (now - departed) / (arrival - departed)),
          ),
          atStop: false,
        };
      return at(previous);
    }
    if (departure !== null && now <= departure) return at(index);
    if (departure !== null && (departed === null || departure >= departed)) {
      previous = index;
      departed = departure;
    }
  }
  // Completed trips stay at their terminus; untimed trips stay at the origin.
  return at(departed === null ? 0 : previous);
}
