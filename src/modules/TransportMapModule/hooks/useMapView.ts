import { useMemo, type RefObject } from "react";
import { useMapView as useGenericMapView } from "../../MapModule/hooks/useMapView";
import type { MapPlace, MapRoute } from "../../MapModule/types";
import {
  getFix,
  freshPosition,
} from "../../TransportCoreModule/providers/geolocation";
import { transportClient } from "../../TransportCoreModule/providers/client";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";
import type { Journey, Place, Stop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { useTransportPalette } from "../../TransportCoreModule/hooks/useTransportPalette";
import { modePalette } from "../../TransportCoreModule/providers/transportPalette";

function mapPlace(place?: Place): MapPlace | undefined {
  return place?.type === "municipality"
    ? { ...place, type: "coordinates" }
    : place;
}

export function useMapView(
  canvas: RefObject<HTMLDivElement | null>,
  options: {
    open: boolean;
    identity: string;
    mode: string | null;
    place?: Place;
    stop?: Stop;
    waiting: boolean;
    journey?: Journey;
    country: string;
    t: Dictionary;
    onPick: (lat: number, lon: number) => void;
  },
) {
  const { t } = options;
  const palette = useTransportPalette();
  const journey = useMemo<MapRoute | undefined>(
    () =>
      options.journey
        ? {
            legs: options.journey.legs.map((leg) => ({
              from: leg.from,
              to: leg.to,
              geometry: leg.geometry,
              color: modePalette(palette, leg.mode)?.foreground,
              lineStyle: leg.mode === "walk" ? "dotted" : "solid",
            })),
            endpointLabels:
              options.mode === "walk" ? [t.from, t.to] : undefined,
            zoomOffset: options.mode === "walk" ? 0 : undefined,
          }
        : undefined,
    [options.journey, options.mode, palette, t.from, t.to],
  );
  return useGenericMapView(canvas, {
    open: options.open,
    identity: options.identity,
    mode: options.mode,
    place: mapPlace(options.place),
    stop: options.stop,
    waiting: options.waiting,
    journey,
    country: options.country,
    config,
    texts: {
      locating: t.locating,
      loadingStopMap: t.loadingStopMap,
      stale: t.stale,
      locationError: t.locationError,
      stopMapError: t.stopMapError,
      routeMapError: t.routeMapError,
      mapError: t.mapError,
      mapUnavailable:
        options.mode === "walk" ? t.walkMapUnavailable : t.mapUnavailable,
    },
    resolveStop: transportClient.stop,
    getCurrentLocation: getFix,
    isFreshPosition: freshPosition,
    onPick: options.onPick,
  });
}
