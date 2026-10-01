import { useRef, type ReactNode } from "react";
import AdSlot from "./AdSlot";
import { useTopAdReveal } from "../hooks/useTopAdReveal";
import type { AdPosition, AdUnit } from "../../../config/ads";
export default function AdFrame({
  enabled,
  units,
  label,
  placeholder,
  children,
}: {
  enabled: boolean;
  units: Record<AdPosition, AdUnit>;
  label: string;
  placeholder: string;
  children: ReactNode;
}) {
  const top = useRef<HTMLDivElement>(null);
  const offset = useTopAdReveal(top);
  return (
    <div className={`site-frame ${enabled ? "with-ads" : ""}`}>
      {enabled && (
        <>
          <div className="top-ad-reveal" data-top-ad-reveal ref={top}>
            <AdSlot
              position="top"
              unit={units.top}
              label={label}
              placeholder={placeholder}
              offset={offset}
            />
          </div>
          <AdSlot
            position="left"
            unit={units.left}
            label={label}
            placeholder={placeholder}
          />
        </>
      )}
      <div className="site-content">{children}</div>
      {enabled && (
        <AdSlot
          position="right"
          unit={units.right}
          label={label}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
