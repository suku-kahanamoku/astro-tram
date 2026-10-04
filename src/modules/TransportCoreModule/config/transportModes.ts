/** Shared presentation for options, journey services and dialogs. */
export const transportModes = {
  walk: {
    icon: "walk",
    label: "mode_walk",
    background: "#eeeae4",
    foreground: "#655e54",
  },
  bus: {
    icon: "bus",
    label: "mode_bus",
    background: "#e2efdf",
    foreground: "#28582b",
  },
  coach: {
    icon: "bus",
    label: "mode_coach",
    background: "#e9edd4",
    foreground: "#4d5716",
  },
  trolleybus: {
    icon: "trolleybus",
    label: "mode_trolleybus",
    background: "#e2f2eb",
    foreground: "#116748",
  },
  tram: {
    icon: "tram",
    label: "mode_tram",
    background: "#fff0dc",
    foreground: "#9a4809",
  },
  train: {
    icon: "train",
    label: "mode_train",
    background: "#e2ecfb",
    foreground: "#24549c",
  },
  metro: {
    icon: "metro",
    label: "mode_metro",
    background: "#f5e0f1",
    foreground: "#853d7b",
  },
  ferry: {
    icon: "ferry",
    label: "mode_ferry",
    background: "#d9f2f7",
    foreground: "#086579",
  },
  airplane: {
    icon: "airplane",
    label: "mode_airplane",
    background: "#e7e3fa",
    foreground: "#574197",
  },
  gondola: {
    icon: "gondola",
    label: "mode_gondola",
    background: "#fff0d5",
    foreground: "#81520e",
  },
  cable_car: {
    icon: "gondola",
    label: "mode_cable_car",
    background: "#ffe6d1",
    foreground: "#934b13",
  },
  funicular: {
    icon: "train",
    label: "mode_funicular",
    background: "#f5e7d9",
    foreground: "#81512c",
  },
  monorail: {
    icon: "train",
    label: "mode_monorail",
    background: "#e2e4f8",
    foreground: "#444d94",
  },
  transport: {
    icon: "transport",
    label: "mode_transport",
    background: "#e8ece1",
    foreground: "#40584a",
  },
  stop: {
    icon: "pin",
    label: "stopName",
    background: "#edf0f3",
    foreground: "#526174",
  },
  city: {
    icon: "building",
    label: "city",
    background: "#e8e5f6",
    foreground: "#63518d",
  },
  location: {
    icon: "locate",
    label: "current",
    background: "#e0f1f5",
    foreground: "#176b80",
  },
  point: {
    icon: "pin",
    label: "mapPoint",
    background: "#edf0f3",
    foreground: "#526174",
  },
  region: {
    icon: "globe",
    label: "allTimetables",
    background: "#edf0f3",
    foreground: "#526174",
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
