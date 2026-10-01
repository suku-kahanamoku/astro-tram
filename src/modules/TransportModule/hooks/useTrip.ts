import { useEffect, useState } from "react";
import type { Trip } from "../types";
import { transportClient } from "../providers/client";
/** Trip data lives only in the mounted view; leaving it aborts pending work. */
export function useTrip(id?: string | null) {
  const [result, setResult] = useState<{
    id?: string | null;
    trip?: Trip;
    error?: string;
  }>({});
  useEffect(() => {
    const controller = new AbortController();
    setResult({ id });
    if (id)
      void transportClient
        .trip(id, controller.signal)
        .then((trip) => {
          if (!controller.signal.aborted) setResult({ id, trip });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ id, error: "unavailable" });
        });
    return () => controller.abort();
  }, [id]);
  return result.id === id ? result : { id };
}
