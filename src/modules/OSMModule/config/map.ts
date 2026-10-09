import type { MapConfig, MapTileConfig } from "../types";

export const osmTiles: MapTileConfig = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

export const osmConfig: MapConfig = {
  tiles: osmTiles,
  minZoom: 2,
  maxZoom: 19,
  animationMs: 250,
  defaultMapCenter: [14.42, 50.075],
  mapCenters: {
    NO: [10.752, 59.911],
    SK: [17.1077, 48.1486],
    AT: [16.3738, 48.2082],
    PL: [19.1451, 51.9194],
  },
  mapZoom: { stop: 17, picker: 13, journeyFitMax: 15, journeyOffset: 1 },
  gpsMaxAgeMs: 30_000,
  gpsTimeoutMs: 12_000,
};
