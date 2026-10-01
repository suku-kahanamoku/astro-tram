/** Transport UI policy; endpoints remain the server-side BFF, never upstream URLs. */
export const transportClientConfig = {
  autocompleteDelayMs: 250,
  minimumQueryLength: 2,
  gpsMaxAgeMs: 30_000,
  gpsFutureToleranceMs: 5_000,
  gpsTimeoutMs: 12_000,
  autocompleteGpsTimeoutMs: 1_500,
  mapZoom: { stop: 17, picker: 13, journeyFitMax: 15, journeyOffset: 1 },
  defaultMapCenter: [14.42, 50.075] as [number, number],
  mapCenters: { NO: [10.752, 59.911] } as Record<string, [number, number]>,
  endpoints: {
    tracking: "/api/transport/tracking/",
    cities: "/api/transport/cities/",
    places: "/api/transport/places/",
    search: "/api/transport/search/",
    trip: "/api/transport/trip/",
    stop: "/api/transport/stop/",
  },
};
