import { useEffect, useState } from "react";
import type { Trip } from "../types";
import { useTripResources } from "./TripResources";
/** Reopening a loaded trip is synchronous; simultaneous consumers share one request. */
export function useTrip(id?: string | null) {
  const resources = useTripResources();
  const [result, setResult] = useState<{
    id?: string | null;
    trip?: Trip;
    error?: string;
  }>({});
  useEffect(() => {
    let active = true;
    if (id)
      void resources
        .load(id)
        .then((trip) => {
          if (active) setResult({ id, trip });
        })
        .catch(() => {
          if (active) setResult({ id, error: "unavailable" });
        });
    return () => {
      active = false;
    };
  }, [id, resources]);
  const cached = id ? resources.peek(id) : undefined;
  return cached
    ? { id, trip: cached, error: undefined }
    : result.id === id
      ? result
      : { id };
}
