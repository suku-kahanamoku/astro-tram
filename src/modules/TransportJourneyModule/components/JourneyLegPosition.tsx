import { useRef, type ReactNode, type RefObject } from "react";
import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import type { Leg, Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { useTrip } from "../hooks/useTrip";
import { useTripProgress } from "../hooks/useTripProgress";
import { useTripTimeline } from "../hooks/useTripTimeline";
import { tripSegment } from "../providers/trip";
import { legTimelineProgress } from "../providers/tripProgress";
import TripVehicleDot from "./TripVehicleDot";

function Position({
  trip,
  leg,
  root,
  t,
  expanded,
}: {
  trip: Trip;
  leg: Leg;
  root: RefObject<HTMLDivElement | null>;
  t: Dictionary;
  expanded: boolean;
}) {
  const live = useTripObservation(leg.tripId);
  const { progress, retained, estimated } = useTripProgress(trip, live);
  const placement = legTimelineProgress(
    progress,
    tripSegment(trip, leg),
    expanded,
  );
  const top = useTripTimeline(
    root,
    placement?.progress ?? null,
    trip,
    expanded,
  );
  return (
    <TripVehicleDot
      trip={trip}
      progress={progress}
      retained={retained}
      estimated={estimated}
      outside={placement?.outside}
      top={
        top === null
          ? null
          : top +
            (placement?.outside === "before"
              ? -14
              : placement?.outside === "after"
                ? 14
                : 0)
      }
      t={t}
    />
  );
}

/** Fetch stop coordinates only for an opened leg with an actual measured position. */
export default function JourneyLegPosition({
  leg,
  t,
  children,
  expanded = false,
}: {
  leg: Leg;
  t: Dictionary;
  children: ReactNode;
  expanded?: boolean;
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
        <Position
          trip={coordinateTrip}
          leg={leg}
          root={root}
          t={t}
          expanded={expanded}
        />
      )}
    </div>
  );
}
