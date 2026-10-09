import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import { useDelayStatus } from "../hooks/useDelayStatus";
import type { Leg, TripObservation } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

/** Realtime response receipt and delay shared by accordion and trip dialog. */
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
  const state = observation?.responseState ?? "pending";
  const response =
    state === "received"
      ? t.trackingResponseReceived
      : state === "error"
        ? t.trackingResponseError
        : t.trackingResponsePending;
  return (
    <span
      className="trip-observation-status"
      data-trip-observation-status
      role="status"
    >
      <span
        className="realtime-response-indicator"
        data-response-state={state}
        role="img"
        aria-label={response}
        title={response}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="realtime-response-light"
            aria-hidden="true"
          />
        ))}
        <span data-response-status className="sr-only">
          {response}
        </span>
      </span>
      {minutes !== null && minutes > 0 && (
        <span
          className="delay-badge"
          data-delay-status
          data-status="delayed"
          data-delay-known={true}
          data-delay-badge={true}
          data-stale={retained ? true : undefined}
          title={retained ? t.delayLastKnown : undefined}
          aria-label={
            retained
              ? `${t.delayBadge.replace("{minutes}", String(minutes))}. ${t.delayLastKnown}`
              : undefined
          }
        >
          {t.delayBadge.replace("{minutes}", String(minutes))}
        </span>
      )}
    </span>
  );
}
