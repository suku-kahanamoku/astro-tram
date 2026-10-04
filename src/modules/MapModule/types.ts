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
