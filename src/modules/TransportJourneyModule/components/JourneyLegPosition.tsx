import { useRef, type ReactNode, type RefObject } from "react";
import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import type { Leg, Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { useTrip } from "../hooks/useTrip";
import { useTripProgress } from "../hooks/useTripProgress";
import { useTripTimeline } from "../hooks/useTripTimeline";
import { tripSegment } from "../providers/trip";
import { compactTripProgress } from "../providers/tripProgress";
import TripVehicleDot from "./TripVehicleDot";

function Position({
  trip,
  leg,
  root,
  t,
}: {
  trip: Trip;
  leg: Leg;
  root: RefObject<HTMLDivElement | null>;
  t: Dictionary;
}) {
  const live = useTripObservation(leg.tripId);
  const { progress, retained, estimated } = useTripProgress(trip, live);
  const compact = compactTripProgress(progress, tripSegment(trip, leg));
  const top = useTripTimeline(root, compact, trip);
  return (
    <TripVehicleDot
      trip={trip}
      progress={progress}
      retained={retained}
      estimated={estimated}
      top={top}
      t={t}
    />
  );
}

/** Fetch stop coordinates only for an opened leg with an actual measured position. */
export default function JourneyLegPosition({
  leg,
  t,
  children,
}: {
  leg: Leg;
  t: Dictionary;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const live = useTripObservation(leg.tripId);
  const { trip } = useTrip(
    live?.position || live?.estimatedProgress ? leg.tripId : undefined,
    !!live?.position,
  );
  const lastTrip = useRef<{ id: string; trip: Trip } | undefined>(undefined);
  if (trip && leg.tripId) lastTrip.current = { id: leg.tripId, trip };
  const coordinateTrip =
    trip ??
    (lastTrip.current?.id === leg.tripId ? lastTrip.current.trip : undefined);
  return (
    <div
      ref={root}
      className={`leg-stops${leg.tripId ? " trip-timeline leg-timeline" : ""}`}
    >
      {children}
      {coordinateTrip && leg.tripId && (
        <Position trip={coordinateTrip} leg={leg} root={root} t={t} />
      )}
    </div>
  );
}
