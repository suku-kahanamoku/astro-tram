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

function mapPlace(place?: Place): MapPlace | undefined {
  return place;
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
  const journey = useMemo<MapRoute | undefined>(
    () =>
      options.journey
        ? {
            legs: options.journey.legs.map((leg) => ({
              from: leg.from,
              to: leg.to,
              geometry: leg.geometry,
              lineStyle: leg.mode === "walk" ? "dotted" : "solid",
            })),
            endpointLabels: options.mode === "walk" ? ["A", "B"] : undefined,
            zoomOffset: options.mode === "walk" ? 0 : undefined,
          }
        : undefined,
    [options.journey, options.mode],
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
