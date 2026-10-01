import { useEffect } from "react";
import { useTripResources } from "./TripResources";
import type { SearchResult } from "../types";
/** Warm static stop lists; consumer requests share/promote the same queued request. */
export function usePrefetchTrips(result: SearchResult | null) {
  const resources = useTripResources();
  useEffect(() => {
    const ids = new Set(
      result?.journeys.flatMap((j) =>
        j.legs.flatMap((l) => (l.tripId ? [l.tripId] : [])),
      ),
    );
    for (const id of ids)
      void resources.load(id, false).catch(() => {
        // A failed speculative request is retried when the user opens this trip.
      });
  }, [result, resources]);
}
