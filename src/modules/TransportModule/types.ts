export type Place =
  | { type: "stop"; id: string; label: string }
  | { type: "coordinates"; lat: number; lon: number; label: string }
  | { type: "current_location"; label: string };
export interface SearchState {
  from?: Place;
  to?: Place;
  at?: string;
  arrive: boolean;
  direct: boolean;
  country: string;
  city?: string;
  scopeLocation?: boolean;
}
export interface Fix {
  lat: number;
  lon: number;
  observedAt: string;
}
export interface Stop {
  id: string | null;
  name: string;
  lat: number | null;
  lon: number | null;
  platform: string | null;
}
export interface Geometry {
  type: "LineString";
  coordinates: number[][];
}
export interface Leg {
  mode: string;
  from: Stop;
  to: Stop;
  scheduledDeparture: string;
  scheduledArrival: string;
  expectedDeparture: string | null;
  expectedArrival: string | null;
  realtime: boolean;
  cancelled: boolean;
  tripId: string | null;
  line: string;
  operator: string;
  geometry: Geometry | null;
}
export interface Journey {
  key: string;
  duration: number;
  transfers: number;
  legs: Leg[];
  source: {
    provider: string;
    mode: string;
    limited: boolean;
    attribution: string;
  };
}
export interface SearchResult {
  city?: string | null;
  resolvedPlaces?: Partial<
    Record<"from" | "to", Stop & { sourceMode: string }>
  >;
  journeys: Journey[];
  partial: boolean;
}
export interface PlaceOption {
  city?: string | null;
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
  sourceMode: string;
}
export interface TripStop {
  tariffZones?: { system: string | null; zone: string }[];
  requestStop?: boolean | null;
  routeKm?: number | null;
  stop: Stop;
  arrival: string | null;
  departure: string | null;
}
export interface TripMetadata {
  line: string | null;
  number: string | null;
  name: string | null;
  serviceDate: string | null;
  operator: {
    name: string;
    city: string | null;
    url: string | null;
    phone: string | null;
  } | null;
  notes: {
    scope: "line" | "trip";
    texts: Record<string, string>;
    defaultLanguage: string | null;
  }[];
}
export interface Trip {
  metadata?: TripMetadata;
  stops: TripStop[];
  sourceMode: string;
}
