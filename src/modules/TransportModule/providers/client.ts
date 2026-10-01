import { transportClientConfig as config } from "../config/client";
import type {
  Trip,
  Stop,
  SearchResult,
  PlaceOption,
  CityOption,
} from "../types";
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
    throw new Error(body.error ?? "unavailable");
  return body.data;
}
export const transportClient = {
  tracking: (id: string, signal: AbortSignal) =>
    request<import("../types").TrackingSession>(config.endpoints.tracking, {
      method: "POST",
      body: JSON.stringify({ id }),
      signal,
    }),
  cities: (country: string, signal: AbortSignal) =>
    request<CityOption[]>(
      `${config.endpoints.cities}?q=${encodeURIComponent(JSON.stringify({ state: country }))}`,
      { signal },
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
  stop: (id: string, signal: AbortSignal) =>
    request<Stop>(`${config.endpoints.stop}?id=${encodeURIComponent(id)}`, {
      signal,
    }),
};
