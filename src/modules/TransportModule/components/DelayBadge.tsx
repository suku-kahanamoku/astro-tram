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
  const [revision, refresh] = useState(0);
  useEffect(() => {
    const deadlines = [leg.predictionValidUntil, live?.validUntil].flatMap(
      (value) =>
        value &&
        Number.isFinite(Date.parse(value)) &&
        Date.parse(value) > Date.now()
          ? [Date.parse(value)]
          : [],
    );
    if (!deadlines.length) return;
    const timer = setTimeout(
      () => refresh((v) => v + 1),
      Math.max(0, Math.min(...deadlines) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [leg.predictionValidUntil, live, revision]);
  const minutes = delayMinutes(leg, live);
  return minutes > 0 && leg.mode !== "walk" ? (
    <span className="delay-badge" data-delay-badge role="status">
      {t.delayBadge.replace("{minutes}", String(minutes))}
    </span>
  ) : null;
}
