import { useRef, useState } from "react";
import Dialog from "../../UIModule/components/Dialog";
import Icon from "../../UIModule/components/TransitIcon";
import TransportBadge from "../../TransportCoreModule/components/TransportBadge";
import { useMapView } from "../hooks/useMapView";
import type { Place, Journey, Stop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function MapDialog({
  open,
  identity,
  mode,
  place,
  stop,
  waiting,
  journey,
  country,
  t,
  onClose,
  onPoint,
}: {
  open: boolean;
  identity: string;
  mode: string | null;
  place?: Place;
  stop?: Stop;
  waiting: boolean;
  journey?: Journey;
  country: string;
  t: Dictionary;
  onClose: () => void;
  onPoint: (lat: number, lon: number) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ lat: 0, lon: 0 });
  const status = useMapView(canvas, {
    open,
    identity,
    mode,
    place,
    stop,
    waiting,
    journey,
    country,
    t,
    onPick: (lat, lon) => setPoint({ lat, lon }),
  });
  const readonly =
    mode === "walk" ||
    place?.type === "current_location" ||
    place?.type === "stop";
  const title =
    mode === "stop"
      ? stop?.name || status.name || t.stopMap
      : mode === "journey"
        ? t.routeMap
        : mode === "walk"
          ? t.walkMap
          : readonly
            ? place?.type === "current_location"
              ? t.current
              : place?.label || t.stopMap
            : t.mapTitle;
  const hint =
    mode === "stop"
      ? t.stopMapHint
      : mode === "journey"
        ? t.routeMapHint
        : mode === "walk"
          ? t.walkMapHint
          : readonly
            ? place?.type === "current_location"
              ? t.currentMapHint
              : t.stopMapHint
            : t.mapHint;
  return (
    <Dialog
      open={open}
      onDismiss={onClose}
      className={`map-dialog${mode === "journey" ? " map-dialog--journey" : ""}`}
      scrollContent={mode === "journey"}
      data-map-dialog
      titleId="map-title"
      titleClassName="map-title-symbol"
      closeLabel={t.close}
      closeButtonAttributes={{ "data-close-map": true }}
      title={
        <>
          {mode !== "journey" && (
            <TransportBadge
              mode={
                mode === "walk"
                  ? "walk"
                  : place?.type === "current_location"
                    ? "location"
                    : mode === "stop" || place?.type === "stop"
                      ? (stop?.modes?.[0] ?? "stop")
                      : "point"
              }
              variant="icon"
              t={t}
            />
          )}
          {title}
        </>
      }
      headerContent={
        <>
          {mode === "walk" && journey && (
            <p data-walk-endpoints>
              {t.from}: {journey.legs[0].from.name} → {t.to}:{" "}
              {journey.legs[0].to.name}
            </p>
          )}
          {mode === "journey" && journey && (
            <div className="route-badges">
              {journey.legs.map((leg, i) => (
                <TransportBadge key={i} mode={leg.mode} line={leg.line} t={t} />
              ))}
            </div>
          )}
        </>
      }
    >
      <p data-map-hint>{hint}</p>
      <div className="map-stage" aria-busy={!status.ready}>
        {status.ready && (
          <div
            ref={status.mount}
            className="map-canvas"
            data-map-canvas
            tabIndex={0}
          />
        )}
        {status.message && (
          <p className="notice" data-map-error>
            {status.message}
          </p>
        )}
      </div>
      {mode !== "journey" && mode !== "stop" && !readonly && (
        <form
          data-map-form
          onSubmit={(e) => {
            e.preventDefault();
            onPoint(point.lat, point.lon);
          }}
        >
          <label>
            {t.lat}
            <input
              data-lat
              type="number"
              step="any"
              min={-90}
              max={90}
              required
              value={point.lat}
              onChange={(e) =>
                setPoint((p) => ({ ...p, lat: Number(e.target.value) }))
              }
            />
          </label>
          <label>
            {t.lon}
            <input
              data-lon
              type="number"
              step="any"
              min={-180}
              max={180}
              required
              value={point.lon}
              onChange={(e) =>
                setPoint((p) => ({ ...p, lon: Number(e.target.value) }))
              }
            />
          </label>
          <button className="button" type="submit">
            {t.usePoint}
            <Icon name="check" size={18} />
          </button>
        </form>
      )}
    </Dialog>
  );
}
