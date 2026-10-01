import { useTripObservation } from "../hooks/useTrackingSnapshot";
import { useRef } from "react";
import TripStops from "./TripStops";
import { useTripProgress } from "../hooks/useTripProgress";
import { useTripTimeline } from "../hooks/useTripTimeline";
import type { Trip, TripObservation, Leg } from "../types";
import type { Dictionary } from "../providers/translations";

export default function TripTimeline({
  trip,
  live,
  leg,
  t,
  locale,
  url,
}: {
  trip: Trip;
  live?: TripObservation;
  leg?: Leg;
  t: Dictionary;
  locale: string;
  url: URL;
}) {
  const root = useRef<HTMLDivElement>(null);
  const observation = useTripObservation(leg?.tripId);
  live = live ?? observation;
  const { progress, retained } = useTripProgress(trip, live);
  const top = useTripTimeline(root, progress, trip);
  const locationLabel = progress
    ? progress.atStop
      ? t.vehicleAtStop.replace("{stop}", trip.stops[progress.from].stop.name)
      : t.vehicleBetweenStops
          .replace("{from}", trip.stops[progress.from].stop.name)
          .replace("{to}", trip.stops[progress.to].stop.name)
    : "";
  const label = retained
    ? `${t.vehicleTimelineLastKnown}: ${locationLabel}`
    : locationLabel;
  return (
    <div ref={root} className="trip-timeline" data-trip-timeline>
      <ul className="trip-stops" data-trip-dialog-stops>
        <TripStops
          trip={trip}
          tripId={leg?.tripId}
          leg={leg}
          t={t}
          locale={locale}
          current={url}
          timeline
        />
      </ul>
      {progress && top !== null && (
        <span
          className="trip-vehicle-dot"
          data-trip-vehicle-dot
          data-retained={retained ? true : undefined}
          data-from={progress.from}
          data-to={progress.to}
          data-fraction={progress.fraction}
          style={{ top }}
          role="img"
          aria-label={label}
          title={`${label}. ${t.vehicleTimelineHint}`}
        />
      )}
      <span className="sr-only" role="status">
        {label}
      </span>
      <p
        className="trip-timeline-hint"
        style={{
          visibility:
            retained || (live?.status === "live" && !progress)
              ? "visible"
              : "hidden",
        }}
      >
        {retained ? t.vehicleTimelineLastKnown : t.vehicleTimelineUnavailable}
      </p>
    </div>
  );
}
