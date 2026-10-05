import type { TripFeature, ReservationKind } from "./config/tripFeatures";
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
  page?: "earlier" | "later";
}
export interface Fix {
  lat: number;
  lon: number;
  observedAt: string;
}
export interface PlaceMetadata {
  state?: string | null;
  city?: string | null;
  modes?: string[];
  transportScope?: "urban" | "regional" | "mixed";
}
export interface Stop extends PlaceMetadata {
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
  delaySeconds?: number | null;
  arrivalEstimated?: boolean;
  predictionValidUntil?: string | null;
  minTransferSeconds?: number;
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
  transferAtRisk?: boolean;
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
  intercity?: boolean;
  city?: string | null;
  resolvedPlaces?: Partial<
    Record<"from" | "to", Stop & { sourceMode: string }>
  >;
  journeys: Journey[];
  partial: boolean;
}
export interface PlaceOption extends PlaceMetadata {
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
  expectedArrival?: string | null;
  expectedDeparture?: string | null;
  predictionValidUntil?: string | null;
}
export interface TripMetadata {
  features?: TripFeature[];
  accessibility?: "accessible" | "partial" | null;
  reservations?: Partial<Record<ReservationKind, "available" | "mandatory">>;
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
    category?: "technical" | "passenger";
    texts: Record<string, string>;
    defaultLanguage: string | null;
  }[];
}
export interface Trip {
  metadata?: TripMetadata;
  stops: TripStop[];
  sourceMode: string;
}

export interface CityOption {
  id: string;
  name: string;
  state: string;
  sourceMode: string;
}

export interface CountryCoverage {
  state: string;
  capabilities: string[];
  searchAvailable: boolean;
  citiesAvailable: boolean;
}

export interface TrackingSession {
  status: string;
  url?: string;
  ticket?: string;
  expiresAt?: string;
  tripId?: string;
}
export interface TripObservation {
  status: string;
  position: { lat: number; lon: number } | null;
  observedAt: string | null;
  validUntil: string | null;
  delaySeconds: number | null;
  cancelled: boolean | null;
  estimatedProgress?: EstimatedTripProgress;
}
export interface EstimatedTripProgress {
  fromIndex: number;
  toIndex: number;
  fromStopId: string;
  toStopId: string;
  fromDeparture: string;
  toArrival: string;
  fraction: number;
  atStop: boolean;
  observedAt: string;
  validUntil: string;
}

/** Public credits for sources belonging to the currently active backend data. */
export interface DataAttribution {
  id: string;
  feed_id: string | null;
  name: string;
  attribution: string;
  license_url: string;
  source_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  requirements: string[];
}
