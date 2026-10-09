import { useImperativeHandle, type Ref } from "react";
import type { Locale } from "../../LangModule/config";
import { dictionary } from "../providers/translations";
import {
  useOSMMap,
  type OSMMapControls,
  type OSMMapOptions,
} from "../hooks/useOSMMap";
import "../styles/map.css";

export default function OSMMap({
  locale = "cs",
  label,
  className = "",
  ref,
  ...options
}: OSMMapOptions & {
  locale?: Locale;
  label?: string;
  className?: string;
  ref?: Ref<OSMMapControls>;
}) {
  const t = dictionary(locale);
  const map = useOSMMap({
    ...options,
    zoomLabels: { zoomIn: t.zoomIn, zoomOut: t.zoomOut },
  });
  useImperativeHandle(
    ref,
    () => ({
      fit: map.fit,
      focus: map.focus,
      zoomBy: map.zoomBy,
      setLayerVisible: map.setLayerVisible,
    }),
    [map.fit, map.focus, map.zoomBy, map.setLayerVisible],
  );
  return (
    <div
      className={`osm-map ${className}`}
      data-osm-map
      data-state={map.status}
    >
      <div
        ref={map.canvas}
        className="osm-map-canvas"
        tabIndex={0}
        role="region"
        aria-label={label ?? t.map}
        aria-busy={options.enabled !== false && map.status === "loading"}
      />
      {options.enabled !== false && map.status !== "ready" && (
        <p
          className="osm-map-status"
          role={map.status === "error" ? "alert" : "status"}
        >
          {map.status === "error" ? t.error : t.loading}
        </p>
      )}
      <button
        type="button"
        className="osm-map-fit"
        onClick={map.fit}
        disabled={map.status !== "ready" || options.enabled === false}
      >
        {t.fit}
      </button>
    </div>
  );
}
