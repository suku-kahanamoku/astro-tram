export interface MapPoint {
  id?: string | null;
  name: string;
  lat: number | null;
  lon: number | null;
}

export interface MapPlace {
  type: string;
  id?: string;
  label?: string;
  lat?: number;
  lon?: number;
}

export interface MapRoute {
  endpointLabels?: readonly [string, string];
  zoomOffset?: number;
  legs: ReadonlyArray<{
    color?: string;
    lineStyle?: "solid" | "dotted";
    from: MapPoint;
    to: MapPoint;
    geometry?: {
      coordinates: ReadonlyArray<ReadonlyArray<number>>;
    } | null;
  }>;
}

export interface MapFix {
  lat: number;
  lon: number;
  observedAt: string;
}

export interface MapConfig {
  tiles?: MapTileConfig;
  minZoom?: number;
  maxZoom?: number;
  animationMs?: number;
  defaultMapCenter: [number, number];
  mapCenters: Record<string, [number, number]>;
  mapZoom: {
    stop: number;
    picker: number;
    journeyFitMax: number;
    journeyOffset: number;
  };
  gpsMaxAgeMs: number;
  gpsTimeoutMs: number;
}

/** Public tile provider configuration, supplied by the application, never backend credentials. */
export interface MapTileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  label?: string;
  color?: string;
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
  /** West, south, east, north in WGS84; may cross the antimeridian. */
  bounds: [number, number, number, number];
}

export type MapLayer = "routes" | "markers" | "selection";

export interface MapTexts {
  locating: string;
  loadingStopMap: string;
  stale: string;
  locationError: string;
  stopMapError: string;
  routeMapError: string;
  mapError: string;
  mapUnavailable: string;
}
