import type { Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import type { TripProgress } from "../providers/tripProgress";

export default function TripVehicleDot({
  trip,
  progress,
  retained,
  estimated = false,
  top,
  t,
}: {
  trip: Trip;
  progress: TripProgress | null;
  retained: boolean;
  estimated?: boolean;
  top: number | null;
  t: Dictionary;
}) {
  if (!progress || top === null) return null;
  const location = progress.atStop
    ? t.vehicleAtStop.replace("{stop}", trip.stops[progress.from].stop.name)
    : t.vehicleBetweenStops
        .replace("{from}", trip.stops[progress.from].stop.name)
        .replace("{to}", trip.stops[progress.to].stop.name);
  const label = estimated
    ? `${t.vehicleTimelineEstimate} ${location}`
    : retained
      ? `${t.vehicleTimelineLastKnown}: ${location}`
      : location;
  return (
    <>
      <span
        className="trip-vehicle-dot"
        data-trip-vehicle-dot
        data-retained={retained ? true : undefined}
        data-estimated={estimated ? true : undefined}
        data-from={progress.from}
        data-to={progress.to}
        data-fraction={progress.fraction}
        style={{ top }}
        role="img"
        aria-label={label}
        title={
          estimated || retained ? label : `${label}. ${t.vehicleTimelineHint}`
        }
      />
      <span className="sr-only" role="status">
        {label}
      </span>
    </>
  );
}
