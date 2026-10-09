import { ApiError, requestJson } from "../../CoreModule/providers/api";
import { transportClientConfig as config } from "../config/client";
import { StaticResponseCache } from "./staticResponseCache";
import type {
  Trip,
  Stop,
  SearchResult,
  PlaceOption,
  CityOption,
  Fix,
  DataAttribution,
} from "../types";
export class TransportRequestError extends ApiError {
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(status, message, retryAfterMs);
    this.name = "TransportRequestError";
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await requestJson<T>(path, options, 30_000);
  } catch (error) {
    if (error instanceof ApiError)
      throw new TransportRequestError(
        error.code,
        error.status,
        error.retryAfterMs,
      );
    throw error;
  }
}

const staticCache = new StaticResponseCache(config.staticCache);
function staticRequest<T>(
  path: string,
  ttl: number,
  signal?: AbortSignal,
): Promise<T> {
  // SSR is shared between visitors; cache only inside the current browser page.
  if (!config.staticCache.enabled || typeof window === "undefined")
    return request<T>(path, { signal });
  return staticCache.get(
    path,
    ttl,
    (sharedSignal) => request<T>(path, { signal: sharedSignal }),
    signal,
  );
}
export const transportClient = {
  presentation: () =>
    staticRequest<unknown>(
      config.endpoints.presentation,
      config.staticCache.catalogTtlMs,
    ),
  attributions: (signal: AbortSignal) =>
    staticRequest<DataAttribution[]>(
      config.endpoints.attributions,
      config.staticCache.metadataTtlMs,
      signal,
    ),
  coverage: (signal: AbortSignal) =>
    staticRequest<import("../types").CountryCoverage[]>(
      config.endpoints.coverage,
      config.staticCache.metadataTtlMs,
      signal,
    ),
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
    fix
      ? request<CityOption[]>(config.endpoints.cities, {
          signal,
          method: "POST",
          body: JSON.stringify({
            q: {
              state: country,
              latitude: fix.lat,
              longitude: fix.lon,
              observed_at: fix.observedAt,
            },
          }),
        })
      : staticRequest<CityOption[]>(
          `${config.endpoints.cities}?q=${encodeURIComponent(JSON.stringify({ state: country }))}`,
          config.staticCache.catalogTtlMs,
          signal,
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
    staticRequest<Trip>(
      `${config.endpoints.trip}?id=${encodeURIComponent(id)}`,
      config.staticCache.resourceTtlMs,
      signal,
    ),
  tripCoordinates: (id: string, signal: AbortSignal) =>
    staticRequest<Trip>(
      `${config.endpoints.trip}?id=${encodeURIComponent(id)}&coordinates=1`,
      config.staticCache.resourceTtlMs,
      signal,
    ),
  stop: (id: string, signal: AbortSignal) =>
    staticRequest<Stop>(
      `${config.endpoints.stop}?id=${encodeURIComponent(id)}`,
      config.staticCache.resourceTtlMs,
      signal,
    ),
};
