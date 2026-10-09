import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import { useDelayStatus } from "../hooks/useDelayStatus";
import type {
  Leg,
  Trip,
  TripObservation,
} from "../../TransportCoreModule/types";
import { useTrip } from "../hooks/useTrip";
import {
  tripProgress,
  lastKnownTripProgress,
  estimatedTripProgress,
} from "../providers/tripProgress";
import { usePredictionExpiry } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

/** The same explicit GPS and delay state in accordion and trip dialog. */
export default function TripObservationStatus({
  leg,
  live,
  trip,
  t,
}: {
  leg: Leg;
  live?: TripObservation;
  trip?: Trip;
  t: Dictionary;
}) {
  const watched = useTripObservation(leg.tripId);
  const observation = live ?? watched;
  const resource = useTrip(leg.tripId, !!observation?.position);
  trip = resource.trip ?? trip;
  usePredictionExpiry([
    observation?.validUntil,
    observation?.estimatedProgress?.validUntil,
  ]);
  const { minutes, retained } = useDelayStatus(leg, observation);
  if (!leg.tripId || leg.mode === "walk") return null;
  const pending = !observation || observation.status === "connecting";
  const fresh =
    observation?.validUntil && Date.parse(observation.validUntil) > Date.now();
  const hasPosition =
    !!trip &&
    !!(
      tripProgress(trip, observation) ??
      lastKnownTripProgress(trip, observation) ??
      estimatedTripProgress(trip, observation)
    );
  const position =
    hasPosition &&
    observation?.estimatedProgress &&
    Date.parse(observation.estimatedProgress.validUntil) > Date.now()
      ? t.trackingEstimated
      : hasPosition && fresh && observation?.position
        ? observation.status === "last_known"
          ? t.trackingLastKnown
          : t.trackingLive
        : pending ||
            (!trip && !resource.error && !!observation?.position && fresh)
          ? t.trackingConnecting
          : t.trackingUnavailable;
  return (
    <span
      className="trip-observation-status"
      data-trip-observation-status
      role="status"
    >
      <span
        className="vehicle-position-indicator"
        data-position-state={
          hasPosition
            ? "live"
            : position === t.trackingConnecting
              ? "connecting"
              : "unavailable"
        }
        role="img"
        aria-label={position}
        title={position}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="vehicle-position-light"
            aria-hidden="true"
          />
        ))}
        <span data-position-status className="sr-only">
          {position}
        </span>
      </span>
      <span
        className={minutes !== null && minutes > 0 ? "delay-badge" : undefined}
        data-delay-status
        data-status={minutes !== null && minutes > 0 ? "delayed" : undefined}
        data-delay-known={minutes !== null || undefined}
        data-delay-badge={(minutes !== null && minutes > 0) || undefined}
        data-stale={retained ? true : undefined}
        title={retained ? t.delayLastKnown : undefined}
        aria-label={
          retained
            ? `${minutes !== null && minutes > 0 ? t.delayBadge.replace("{minutes}", String(minutes)) : t.delayOnTime}. ${t.delayLastKnown}`
            : undefined
        }
      >
        {minutes === null
          ? t.delayUnknown
          : minutes > 0
            ? t.delayBadge.replace("{minutes}", String(minutes))
            : t.delayOnTime}
      </span>
    </span>
  );
}
