import { transportClientConfig as config } from "../config/client";
import Map from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import OSM from "ol/source/OSM.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";
import { fromLonLat, toLonLat } from "ol/proj.js";
import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style.js";
import "ol/ol.css";
import type { Journey } from "../types";
export function createMap(
  target: HTMLElement,
  options: {
    center: [number, number];
    onPick?: (lat: number, lon: number) => void;
    journey?: Journey;
    readOnly?: boolean;
  },
) {
  const source = new VectorSource();
  const style = new Style({
    stroke: new Stroke({ color: "#ed483b", width: 4 }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: "#ed483b" }),
      stroke: new Stroke({ color: "#fff8ee", width: 3 }),
    }),
  });
  const map = new Map({
    target,
    layers: [
      new TileLayer({ source: new OSM() }),
      new VectorLayer({ source, style }),
    ],
    view: new View({
      center: fromLonLat(options.center),
      zoom: options.readOnly ? config.mapZoom.stop : config.mapZoom.picker,
    }),
  });
  const pick = (lat: number, lon: number) => {
    source.clear();
    source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
  };
  if (options.journey) {
    for (const leg of options.journey.legs) {
      if (leg.geometry)
        source.addFeature(
          new Feature(
            new LineString(leg.geometry.coordinates.map((c) => fromLonLat(c))),
          ),
        );
      for (const stop of [leg.from, leg.to])
        if (stop.lat !== null && stop.lon !== null)
          source.addFeature(
            new Feature(new Point(fromLonLat([stop.lon, stop.lat]))),
          );
    }
    if (source.getFeatures().length) {
      map.getView().fit(source.getExtent()!, {
        padding: [50, 50, 50, 50],
        maxZoom: config.mapZoom.journeyFitMax,
      });
      map
        .getView()
        .setZoom(
          (map.getView().getZoom() ?? config.mapZoom.journeyFitMax) +
            config.mapZoom.journeyOffset,
        );
    }
  } else {
    pick(options.center[1], options.center[0]);
    if (!options.readOnly)
      map.on("singleclick", (e) => {
        const [lon, lat] = toLonLat(e.coordinate);
        const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;
        pick(lat, normalized);
        options.onPick?.(Number(lat.toFixed(6)), Number(normalized.toFixed(6)));
      });
  }
  return {
    pick,
    attach: (target: HTMLElement | undefined) => {
      map.setTarget(target);
      if (target) map.updateSize();
    },
    clear: () => source.clear(),
    center: (lat: number, lon: number) =>
      map.getView().setCenter(fromLonLat([lon, lat])),
    dispose: () => {
      map.setTarget(undefined);
      map.dispose();
    },
    refresh: () => map.updateSize(),
    features: source.getFeatures().length,
  };
}
