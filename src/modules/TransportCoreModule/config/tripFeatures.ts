/** Shared allowlist for normalized provider metadata and its passenger-facing presentation. */
export const tripFeatures = {
  BICYCLE_TRANSPORT: { icon: "bicycle", label: "featureBicycle" },
  LUGGAGE_TRANSPORT: { icon: "suitcase", label: "featureLuggage" },
  WIFI: { icon: "wifi", label: "featureWifi" },
  SOCKETS_230V: { icon: "plug", label: "featureSockets" },
  TOILETS: { icon: "info", label: "featureToilets" },
  REFRESHMENTS: { icon: "cup", label: "featureRefreshments" },
  INFOTAINMENT: { icon: "info", label: "featureInfotainment" },
  AIR_CONDITIONING: { icon: "info", label: "featureAirConditioning" },
} as const;
export type TripFeature = keyof typeof tripFeatures;
export const reservationLabels = {
  bicycle: { icon: "bicycle", label: "bicycleReservation" },
  luggage: { icon: "suitcase", label: "luggageReservation" },
  passenger: { icon: "ticket", label: "passengerReservation" },
} as const;
export type ReservationKind = keyof typeof reservationLabels;
