import { useTripObservation } from "../hooks/useTrackingSnapshot";
import type { Leg, TripObservation } from "../types";
import type { Dictionary } from "../providers/translations";
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
  if (leg.mode === "walk") return null;
  const status =
    minutes === null ? "unknown" : minutes > 0 ? "delayed" : "on-time";
  const label =
    minutes === null
      ? t.delayUnknown
      : minutes > 0
        ? t.delayBadge.replace("{minutes}", String(minutes))
        : t.delayOnTime;
  return (
    <span
      className="delay-badge"
      data-delay-badge
      data-status={status}
      data-stale={retained ? true : undefined}
      role="status"
      title={retained ? t.delayLastKnown : undefined}
      aria-label={retained ? `${label}. ${t.delayLastKnown}` : undefined}
    >
      {label}
    </span>
  );
}
