import { useMemo } from "react";
import { useTrip } from "./useTrip";
import type { Trip } from "../types";
/** Optional static coordinates may finish later; never replace displayed stop rows. */
export function useTripCoordinates(trip: Trip, id?: string | null) {
  const needsCoordinates = trip.stops.some(
    ({ stop }) => stop.lat === null || stop.lon === null,
  );
  const { trip: enriched } = useTrip(needsCoordinates ? id : undefined, true);
  return useMemo(() => {
    // An upstream timetable can change between calls. Never attach coordinates by
    // index to a different stop occurrence or a different service time.
    if (
      !enriched ||
      trip.stops.length !== enriched.stops.length ||
      trip.stops.some(
        (call, i) =>
          call.stop.id !== enriched.stops[i].stop.id ||
          call.arrival !== enriched.stops[i].arrival ||
          call.departure !== enriched.stops[i].departure,
      )
    )
      return trip;
    return {
      ...trip,
      stops: trip.stops.map((call, i) => ({
        ...call,
        stop: {
          ...call.stop,
          lat: enriched.stops[i].stop.lat,
          lon: enriched.stops[i].stop.lon,
        },
      })),
    };
  }, [trip, enriched]);
}
