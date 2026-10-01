import { useEffect, useState } from "react";
import type { Leg, TripObservation } from "../types";
import type { Dictionary } from "../providers/translations";
import { delayMinutes } from "../providers/tracking";
export default function DelayBadge({
  leg,
  live,
  t,
}: {
  leg: Leg;
  live?: TripObservation;
  t: Dictionary;
}) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!leg.predictionValidUntil) return;
    const timer = setTimeout(
      () => refresh((v) => v + 1),
      Math.max(0, Date.parse(leg.predictionValidUntil) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [leg.predictionValidUntil]);
  const minutes = delayMinutes(leg, live);
  return minutes > 0 && leg.mode !== "walk" ? (
    <span className="delay-badge" data-delay-badge role="status">
      {t.delayBadge.replace("{minutes}", String(minutes))}
    </span>
  ) : null;
}
