import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import { useTripCoordinates } from "../hooks/useTripCoordinates";
import { useRef } from "react";
import TripStops from "./TripStops";
import TripVehicleDot from "./TripVehicleDot";
import { useTripProgress } from "../hooks/useTripProgress";
import { useTripTimeline } from "../hooks/useTripTimeline";
import type {
  Trip,
  TripObservation,
  Leg,
} from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

export default function TripTimeline({
  trip,
  live,
  leg,
  t,
  locale,
  url,
  referenceTime,
}: {
  trip: Trip;
  live?: TripObservation;
  leg?: Leg;
  t: Dictionary;
  locale: string;
  url: URL;
  referenceTime?: string | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const observation = useTripObservation(leg?.tripId);
  live = live ?? observation;
  const coordinateTrip = useTripCoordinates(
    trip,
    live?.position ? leg?.tripId : undefined,
  );
  const { progress, retained, estimated } = useTripProgress(
    coordinateTrip,
    live,
  );
  const top = useTripTimeline(root, progress, trip);
  return (
    <div ref={root} className="trip-timeline" data-trip-timeline>
      <ul className="trip-stops" data-trip-dialog-stops>
        <TripStops
          trip={trip}
          leg={leg}
          t={t}
          locale={locale}
          current={url}
          referenceTime={referenceTime}
          timeline
        />
      </ul>
      <TripVehicleDot
        trip={trip}
        progress={progress}
        retained={retained}
        estimated={estimated}
        top={top}
        t={t}
      />
    </div>
  );
}
