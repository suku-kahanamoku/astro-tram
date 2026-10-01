import { useEffect, useState } from "react";
import type { Leg, TripObservation } from "../../TransportCoreModule/types";
import { knownDelayMinutes } from "../../TransportTrackingModule/providers/tracking";

/** Presentation only: retain the last confirmed delay, never GPS or routing predictions. */
export function useDelayStatus(leg: Leg, live?: TripObservation) {
  const key = JSON.stringify([
    leg.tripId,
    leg.scheduledDeparture,
    leg.scheduledArrival,
  ]);
  const [last, setLast] = useState<{
    key: string;
    minutes: number;
    fromLive: boolean;
  }>();
  const [revision, refresh] = useState(0);
  const liveMinutes = knownDelayMinutes({ ...leg, realtime: false }, live);
  // Once an actual vehicle update arrived, do not fall back to the older search snapshot.
  const minutes =
    liveMinutes ??
    (last?.key === key && last.fromLive ? null : knownDelayMinutes(leg));
  useEffect(() => {
    if (minutes !== null)
      setLast({ key, minutes, fromLive: liveMinutes !== null });
    else setLast((previous) => (previous?.key === key ? previous : undefined));
  }, [key, minutes, liveMinutes]);
  useEffect(() => {
    const deadlines = [leg.predictionValidUntil, live?.validUntil].flatMap(
      (value) =>
        value && Date.parse(value) > Date.now() ? [Date.parse(value)] : [],
    );
    if (!deadlines.length) return;
    const timer = setTimeout(
      () => refresh((v) => v + 1),
      Math.max(0, Math.min(...deadlines) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [leg.predictionValidUntil, live?.validUntil, revision]);
  const retained = minutes === null && last?.key === key;
  return { minutes: minutes ?? (retained ? last.minutes : null), retained };
}
