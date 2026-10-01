import { useTripObservation } from "../hooks/useTrackingSnapshot";
import { useEffect, useRef, useState } from "react";
import type { TripObservation } from "../types";
import type { Dictionary } from "../providers/translations";
/** OpenLayers owns its canvas, React owns freshness and lifecycle. */
export default function VehicleTracking({
  live,
  tripId,
  t,
}: {
  live?: TripObservation;
  tripId?: string | null;
  t: Dictionary;
}) {
  const observation = useTripObservation(tripId);
  live = live ?? observation;
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<
    ReturnType<typeof import("../providers/map").createMap> | undefined
  >(undefined);
  const point = useRef(live?.position);
  point.current = live?.position;
  const [failed, setFailed] = useState(false);
  const active = live?.status === "live" && !!live.position;
  useEffect(() => {
    if (!active || map.current) return;
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
    };
  }, [active]);
  useEffect(
    () => () => {
      map.current?.dispose();
      map.current = undefined;
    },
    [],
  );
  useEffect(() => {
    if (live?.position) map.current?.pick(live.position.lat, live.position.lon);
    else map.current?.clear();
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
      <div
        ref={canvas}
        className="vehicle-map"
        data-vehicle-map={active ? true : undefined}
        tabIndex={0}
        aria-label={t.trackingTitle}
      />
    </section>
  );
}
