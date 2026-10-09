import { useEffect, useMemo, useState } from "react";
import {
  tripProgress,
  lastKnownTripProgress,
  displayTripProgress,
  type TripProgress,
} from "../providers/tripProgress";
import type { Trip, TripObservation } from "../../TransportCoreModule/types";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";

/** Hold the last resolved point of this trip while the dialog remains mounted. */
export function useTripProgress(
  trip: Trip,
  live?: TripObservation,
  mode?: string,
) {
  const [last, setLast] = useState<{
    identity: string;
    progress: TripProgress;
  } | null>(null);
  const [, refresh] = useState(0);
  // Optional coordinate enrichment must not discard the last unambiguous position.
  const identity = useMemo(
    () =>
      JSON.stringify(
        trip.stops.map(({ stop, arrival, departure }) => [
          stop.id,
          arrival,
          departure,
        ]),
      ),
    [trip],
  );
  const remembered = last?.identity === identity ? last.progress : null;
  // The timetable is a display estimate, not proof of live GPS or of zero delay.
  // It also works while the independent realtime service is pending/unavailable.
  const display = displayTripProgress(
    trip,
    live,
    remembered,
    Date.now(),
    true,
    mode,
  );
  useEffect(() => {
    const progress =
      tripProgress(trip, live, Date.now(), mode) ??
      lastKnownTripProgress(trip, live, Date.now(), mode);
    if (progress) setLast({ identity, progress });
    else
      setLast((previous) =>
        previous?.identity === identity ? previous : null,
      );
  }, [trip, identity, live, mode]);
  useEffect(() => {
    if (!display.timetable) return;
    // Only the small timeline component ticks; static stop rows are memoized.
    const timer = setInterval(
      () => refresh((value) => value + 1),
      config.timeline.predictionTickMs,
    );
    return () => clearInterval(timer);
  }, [display.timetable]);
  useEffect(() => {
    const deadline = live?.estimatedProgress?.validUntil ?? live?.validUntil;
    if (!deadline) return;
    const remaining = Date.parse(deadline) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => refresh((value) => value + 1), remaining);
    return () => clearTimeout(timer);
  }, [live]);
  return display;
}
