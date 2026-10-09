import { useCallback, useEffect, useRef, useState } from "react";
import { osmConfig } from "../config/map";
import type {
  MapConfig,
  MapLayer,
  MapMarker,
  MapRoute,
  MapTileConfig,
  MapViewport,
} from "../types";

export interface OSMMapOptions {
  enabled?: boolean;
  center?: [number, number];
  zoom?: number;
  config?: MapConfig;
  tiles?: MapTileConfig;
  route?: MapRoute;
  markers?: readonly MapMarker[];
  readOnly?: boolean;
  zoomLabels?: { zoomIn: string; zoomOut: string };
  onPick?: (lat: number, lon: number) => void;
  onMarkerSelect?: (marker: MapMarker) => void;
  onViewportChange?: (viewport: MapViewport) => void;
}

export interface OSMMapControls {
  fit: () => void;
  focus: (lat: number, lon: number, zoom?: number) => void;
  zoomBy: (delta: number) => void;
  setLayerVisible: (layer: MapLayer, visible: boolean) => void;
}

/** One OpenLayers instance per mount; incoming data never resets the user's viewport. */
export function useOSMMap(options: OSMMapOptions) {
  const canvas = useRef<HTMLDivElement>(null);
  const handle = useRef<
    ReturnType<typeof import("../providers/map").createMap> | undefined
  >(undefined);
  const latest = useRef(options);
  latest.current = options;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const { enabled = true, config = osmConfig, tiles, zoomLabels } = options;
  useEffect(() => {
    if (!enabled || !canvas.current) return;
    let disposed = false;
    setStatus("loading");
    void import("../providers/map")
      .then(({ createMap }) => {
        if (disposed || !canvas.current) return;
        const current = latest.current;
        handle.current = createMap(canvas.current, {
          center: current.center ?? config.defaultMapCenter,
          zoom: current.zoom,
          config,
          tiles,
          journey: current.route,
          markers: current.markers,
          readOnly: current.readOnly ?? !current.onPick,
          zoomLabels,
          onPick: (lat, lon) => latest.current.onPick?.(lat, lon),
          onMarkerSelect: (marker) => latest.current.onMarkerSelect?.(marker),
          onViewportChange: (viewport) =>
            latest.current.onViewportChange?.(viewport),
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
      handle.current?.dispose();
      handle.current = undefined;
    };
  }, [
    enabled,
    config,
    tiles,
    options.readOnly,
    Boolean(options.onPick),
    zoomLabels?.zoomIn,
    zoomLabels?.zoomOut,
  ]);
  useEffect(() => {
    handle.current?.setMarkers(options.markers ?? []);
  }, [options.markers]);
  useEffect(() => {
    handle.current?.setRoute(options.route);
  }, [options.route]);
  useEffect(() => {
    if (options.center)
      handle.current?.focus(options.center[1], options.center[0], options.zoom);
  }, [options.center?.[0], options.center?.[1], options.zoom]);
  return {
    canvas,
    status,
    fit: useCallback(() => {
      handle.current?.fit();
    }, []),
    focus: useCallback((lat: number, lon: number, zoom?: number) => {
      handle.current?.focus(lat, lon, zoom);
    }, []),
    zoomBy: useCallback((delta: number) => {
      handle.current?.zoomBy(delta);
    }, []),
    setLayerVisible: useCallback((layer: MapLayer, visible: boolean) => {
      handle.current?.setLayerVisible(layer, visible);
    }, []),
  };
}
