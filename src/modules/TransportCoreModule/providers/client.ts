import { transportClientConfig as config } from "../config/client";
import type {
  Trip,
  Stop,
  SearchResult,
  PlaceOption,
  CityOption,
  Fix,
  DataAttribution,
} from "../types";
export class TransportRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok || body.success !== true)
    throw new TransportRequestError(
      body.error ?? "unavailable",
      response.status,
      response.headers.has("Retry-After")
        ? Math.max(
            1000,
            /^\d+$/.test(response.headers.get("Retry-After")!)
              ? Number(response.headers.get("Retry-After")) * 1000
              : Date.parse(response.headers.get("Retry-After")!) - Date.now(),
          ) || undefined
        : undefined,
    );
  return body.data;
}
export const transportClient = {
  attributions: (signal: AbortSignal) =>
    request<DataAttribution[]>(config.endpoints.attributions, { signal }),
  coverage: (signal: AbortSignal) =>
    request<import("../types").CountryCoverage[]>(config.endpoints.coverage, {
      signal,
    }),
  tracking: (id: string, signal: AbortSignal) =>
    request<import("../types").TrackingSession>(config.endpoints.tracking, {
      method: "POST",
      body: JSON.stringify({ id }),
      signal,
    }),
  observation: (id: string, signal: AbortSignal) =>
    request<unknown>(
      `${config.endpoints.observation}?id=${encodeURIComponent(id)}`,
      { signal },
    ),
  cities: (country: string, signal: AbortSignal, fix?: Fix) =>
    request<CityOption[]>(
      fix
        ? config.endpoints.cities
        : `${config.endpoints.cities}?q=${encodeURIComponent(JSON.stringify({ state: country }))}`,
      {
        signal,
        ...(fix
          ? {
              method: "POST",
              body: JSON.stringify({
                q: {
                  state: country,
                  latitude: fix.lat,
                  longitude: fix.lon,
                  observed_at: fix.observedAt,
                },
              }),
            }
          : {}),
      },
    ),
  search: (body: Record<string, unknown>, signal: AbortSignal) =>
    request<SearchResult>(config.endpoints.search, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  places: (
    q: Record<string, unknown>,
    signal: AbortSignal,
    privateQuery = false,
  ) =>
    request<PlaceOption[]>(
      privateQuery
        ? config.endpoints.places
        : `${config.endpoints.places}?q=${encodeURIComponent(JSON.stringify(q))}`,
      {
        signal,
        ...(privateQuery
          ? { method: "POST", body: JSON.stringify({ q }) }
          : {}),
      },
    ),
  trip: (id: string, signal: AbortSignal) =>
    request<Trip>(`${config.endpoints.trip}?id=${encodeURIComponent(id)}`, {
      signal,
    }),
  tripCoordinates: (id: string, signal: AbortSignal) =>
    request<Trip>(
      `${config.endpoints.trip}?id=${encodeURIComponent(id)}&coordinates=1`,
      { signal },
    ),
  stop: (id: string, signal: AbortSignal) =>
    request<Stop>(`${config.endpoints.stop}?id=${encodeURIComponent(id)}`, {
      signal,
    }),
};
