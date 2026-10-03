import { useTripObservation } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import type { Leg, TripObservation } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { useDelayStatus } from "../hooks/useDelayStatus";
export default function DelayBadge({
  leg,
  live,
  t,
}: {
  leg: Leg;
  live?: TripObservation;
  t: Dictionary;
}) {
  const observation = useTripObservation(leg.tripId);
  const { minutes, retained } = useDelayStatus(leg, live ?? observation);
  if (leg.mode === "walk" || minutes === null || minutes <= 0) return null;
  const label = t.delayBadge.replace("{minutes}", String(minutes));
  return (
    <span
      className="delay-badge"
      data-delay-badge
      data-status="delayed"
      data-delay-known={true}
      data-stale={retained ? true : undefined}
      role="status"
      title={retained ? t.delayLastKnown : undefined}
      aria-label={retained ? `${label}. ${t.delayLastKnown}` : undefined}
    >
      {label}
    </span>
  );
}
