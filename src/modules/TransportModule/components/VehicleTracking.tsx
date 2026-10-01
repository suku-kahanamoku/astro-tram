import { useEffect, useRef, useState } from "react";
import type { TripObservation } from "../types";
import type { Dictionary } from "../providers/translations";
/** OpenLayers owns its canvas, React owns freshness and lifecycle. */
export default function VehicleTracking({
  live,
  t,
}: {
  live?: TripObservation;
  t: Dictionary;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<
    ReturnType<typeof import("../providers/map").createMap> | undefined
  >(undefined);
  const point = useRef(live?.position);
  point.current = live?.position;
  const [failed, setFailed] = useState(false);
  const active = live?.status === "live" && !!live.position;
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    setFailed(false);
    void import("../providers/map")
      .then(({ createMap }) => {
        if (disposed || !canvas.current || !point.current) return;
        map.current = createMap(canvas.current, {
          center: [point.current.lon, point.current.lat],
          readOnly: true,
        });
        map.current.refresh();
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      map.current?.dispose();
      map.current = undefined;
    };
  }, [active]);
  useEffect(() => {
    if (live?.position) map.current?.pick(live.position.lat, live.position.lon);
  }, [live]);
  const message = active
    ? t.trackingLive
    : live?.status === "unsupported"
      ? t.trackingUnsupported
      : live?.status === "connecting"
        ? t.trackingConnecting
        : t.trackingUnavailable;
  return (
    <section className="vehicle-tracking" aria-label={t.trackingTitle}>
      <p role="status">{failed ? t.mapError : message}</p>
      {active && (
        <div
          ref={canvas}
          className="vehicle-map"
          data-vehicle-map
          tabIndex={0}
          aria-label={t.trackingTitle}
        />
      )}
    </section>
  );
}
