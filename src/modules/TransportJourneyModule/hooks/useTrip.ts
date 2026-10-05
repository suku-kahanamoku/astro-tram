import { useEffect, useState } from "react";
import type { Trip } from "../../TransportCoreModule/types";
import { useTripResources } from "./TripResources";
/** Reopening a loaded trip is synchronous; simultaneous consumers share one request. */
export function useTrip(id?: string | null, coordinates = false) {
  const resources = useTripResources();
  const [result, setResult] = useState<{
    id?: string | null;
    coordinates?: boolean;
    trip?: Trip;
    error?: string;
  }>({});
  useEffect(() => {
    let active = true;
    if (id)
      void resources
        .load(id, true, coordinates)
        .then((trip) => {
          if (active) setResult({ id, coordinates, trip });
        })
        .catch(() => {
          if (active) setResult({ id, coordinates, error: "unavailable" });
        });
    return () => {
      active = false;
    };
  }, [id, resources, coordinates]);
  const cached = id ? resources.peek(id, coordinates) : undefined;
  return cached
    ? { id, trip: cached, error: undefined }
    : result.id === id && result.coordinates === coordinates
      ? result
      : { id };
}
