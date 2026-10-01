import { useEffect, useState } from "react";
import { freshTripPosition, tripProgress } from "../providers/tripProgress";
import type { Trip, TripObservation } from "../types";

/** Retain a resolved point only for the same trip and its original GPS validity window. */
export function useTripProgress(trip: Trip, live?: TripObservation) {
  const [last, setLast] = useState<{
    trip: Trip;
    live: TripObservation;
  } | null>(null);
  const [revision, refresh] = useState(0);
  const now = Date.now();
  const current = tripProgress(trip, live, now);
  const remembered =
    freshTripPosition(live, now) && last?.trip === trip
      ? tripProgress(trip, last.live, now)
      : null;
  const progress = current ?? remembered;
  const retained = !current && !!remembered;
  const expiresAt = current
    ? live?.validUntil
    : remembered
      ? last?.live.validUntil
      : null;

  useEffect(() => {
    if (tripProgress(trip, live)) setLast({ trip, live: live! });
    else
      setLast((previous) =>
        freshTripPosition(live) && previous?.trip === trip ? previous : null,
      );
  }, [trip, live]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(
      () => refresh((v) => v + 1),
      Math.max(1, Date.parse(expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [expiresAt, revision]);

  return { progress, retained };
}
