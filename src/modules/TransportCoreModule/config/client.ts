/** Transport UI policy; endpoints remain the server-side BFF, never upstream URLs. */
export const transportClientConfig = {
  autocompleteDelayMs: 250,
  minimumQueryLength: 2,
  gpsMaxAgeMs: 30_000,
  lastKnownGpsMaxAgeMs: 90_000,
  gpsFutureToleranceMs: 5_000,
  gpsTimeoutMs: 12_000,
  autocompleteGpsTimeoutMs: 1_500,
  timeline: {
    predictionTickMs: 1_000,
    atStopMeters: 35,
    maxOffsetMeters: 120,
    ambiguityMeters: 25,
    minSegmentMeters: 10,
    maxSegmentMeters: 10000,
    // Train stops may be far apart; their schematic chord is not the railway geometry.
    railProjection: { maxSegmentMeters: 100000, maxOffsetMeters: 3000 },
  },
  endpoints: {
    presentation: "/api/transport/presentation/",
    attributions: "/api/transport/attributions/",
    coverage: "/api/transport/coverage/",
    tracking: "/api/transport/tracking/",
    observation: "/api/transport/observation/",
    cities: "/api/transport/cities/",
    places: "/api/transport/places/",
    search: "/api/transport/search/",
    trip: "/api/transport/trip/",
    stop: "/api/transport/stop/",
  },
};
