import { useEffect, useState } from "react";
import { tripProgress, type TripProgress } from "../providers/tripProgress";
import type { Trip, TripObservation } from "../types";

/** Hold the last resolved point of this trip while the dialog remains mounted. */
export function useTripProgress(trip: Trip, live?: TripObservation) {
  const [last, setLast] = useState<{
    trip: Trip;
    progress: TripProgress;
  } | null>(null);
  const [, refresh] = useState(0);
  const current = tripProgress(trip, live);
  const remembered = last?.trip === trip ? last.progress : null;
  useEffect(() => {
    const progress = tripProgress(trip, live);
    if (progress) setLast({ trip, progress });
    else setLast((previous) => (previous?.trip === trip ? previous : null));
  }, [trip, live]);
  useEffect(() => {
    if (!live?.validUntil) return;
    const remaining = Date.parse(live.validUntil) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => refresh((value) => value + 1), remaining);
    return () => clearTimeout(timer);
  }, [live]);
  return {
    progress: current ?? remembered,
    retained: !current && !!remembered,
  };
}
