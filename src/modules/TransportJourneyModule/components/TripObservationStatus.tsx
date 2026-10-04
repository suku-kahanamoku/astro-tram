import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import { useDelayStatus } from "../hooks/useDelayStatus";
import type { Leg, TripObservation } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

/** The same explicit GPS and delay state in accordion and trip dialog. */
export default function TripObservationStatus({
  leg,
  live,
  t,
}: {
  leg: Leg;
  live?: TripObservation;
  t: Dictionary;
}) {
  const watched = useTripObservation(leg.tripId);
  const observation = live ?? watched;
  const { minutes, retained } = useDelayStatus(leg, observation);
  if (!leg.tripId || leg.mode === "walk") return null;
  const pending = !observation || observation.status === "connecting";
  const fresh =
    observation?.validUntil && Date.parse(observation.validUntil) > Date.now();
  const position =
    observation?.estimatedProgress &&
    Date.parse(observation.estimatedProgress.validUntil) > Date.now()
      ? t.trackingEstimated
      : fresh && observation?.position
        ? observation.status === "last_known"
          ? t.trackingLastKnown
          : t.trackingLive
        : pending
          ? t.trackingConnecting
          : t.trackingUnavailable;
  return (
    <p
      className="trip-observation-status"
      data-trip-observation-status
      role="status"
    >
      <span data-position-status>{position}</span>
      {minutes === null ? (
        <span data-delay-status>{t.delayUnknown}</span>
      ) : minutes <= 0 ? (
        <span
          data-delay-status
          data-stale={retained ? true : undefined}
          title={retained ? t.delayLastKnown : undefined}
          aria-label={
            retained ? `${t.delayOnTime}. ${t.delayLastKnown}` : undefined
          }
        >
          {t.delayOnTime}
        </span>
      ) : null}
    </p>
  );
}
