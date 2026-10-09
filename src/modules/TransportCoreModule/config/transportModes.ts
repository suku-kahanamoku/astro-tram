/** Client icons and labels only. Colors are supplied by Java presentation API. */
export const transportModes = {
  walk: {
    icon: "walk",
    label: "mode_walk",
  },
  bus: {
    icon: "bus",
    label: "mode_bus",
  },
  coach: {
    icon: "bus",
    label: "mode_coach",
  },
  trolleybus: {
    icon: "trolleybus",
    label: "mode_trolleybus",
  },
  tram: {
    icon: "tram",
    label: "mode_tram",
  },
  train: {
    icon: "train",
    label: "mode_train",
  },
  metro: {
    icon: "metro",
    label: "mode_metro",
  },
  ferry: {
    icon: "ferry",
    label: "mode_ferry",
  },
  airplane: {
    icon: "airplane",
    label: "mode_airplane",
  },
  gondola: {
    icon: "gondola",
    label: "mode_gondola",
  },
  cable_car: {
    icon: "gondola",
    label: "mode_cable_car",
  },
  funicular: {
    icon: "train",
    label: "mode_funicular",
  },
  monorail: {
    icon: "train",
    label: "mode_monorail",
  },
  transport: {
    icon: "transport",
    label: "mode_transport",
  },
  stop: {
    icon: "pin",
    label: "stopName",
  },
  city: {
    icon: "building",
    label: "city",
  },
  street: {
    icon: "map",
    label: "street",
  },
  address: {
    icon: "building",
    label: "address",
  },
  location: {
    icon: "locate",
    label: "current",
  },
  point: {
    icon: "pin",
    label: "mapPoint",
  },
  region: {
    icon: "globe",
    label: "allTimetables",
  },
} as const;

export type TransportMode = keyof typeof transportModes;
/** Wire values accepted for served modes; place/action symbols are UI only. */
export const servedModes = new Set<string>([
  "bus",
  "coach",
  "trolleybus",
  "tram",
  "train",
  "metro",
  "ferry",
  "airplane",
  "gondola",
  "cable_car",
  "funicular",
  "monorail",
]);
