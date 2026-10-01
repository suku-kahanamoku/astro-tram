import { useRef, type CSSProperties } from "react";
import { useAds } from "../hooks/useAds";
import type { AdPosition, AdUnit } from "../../../config/ads";
export default function AdSlot({
  position,
  unit,
  label,
  placeholder,
  offset = 0,
}: {
  position: AdPosition;
  unit: AdUnit;
  label: string;
  placeholder: string;
  offset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useAds(ref, unit);
  return (
    <aside
      className={`ad-slot ad-${position}`}
      aria-label={label}
      style={{ "--ad-reveal-offset": `${offset}px` } as CSSProperties}
    >
      <span className="ad-label">{label}</span>
      <div
        className="ad-content"
        id={`ad-${position}`}
        data-ad-unit={JSON.stringify(unit)}
        data-ad-state={state}
      >
        <div
          ref={ref}
          id={`ad-provider-${position}`}
          className="ad-provider"
          style={{ width: "100%" }}
        />
        {state !== "requested" && (
          <span className="ad-placeholder">{placeholder}</span>
        )}
      </div>
    </aside>
  );
}
