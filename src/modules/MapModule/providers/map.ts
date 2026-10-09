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
import { Style, Stroke, Fill, Text, Circle as CircleStyle } from "ol/style.js";
import { defaults as defaultInteractions } from "ol/interaction/defaults.js";
import "ol/ol.css";
import type { MapConfig, MapRoute } from "../types";
import { routeStyle } from "./routeStyle";

export function createMap(
  target: HTMLElement,
  options: {
    center: [number, number];
    config: MapConfig;
    onPick?: (lat: number, lon: number) => void;
    journey?: MapRoute;
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
    // Dialog focus starts on its close button; gestures must work from the first event.
    interactions: defaultInteractions({ onFocusOnly: false }),
    layers: [
      new TileLayer({ source: new OSM() }),
      new VectorLayer({ source, style }),
    ],
    view: new View({
      center: fromLonLat(options.center),
      zoom: options.readOnly
        ? options.config.mapZoom.stop
        : options.config.mapZoom.picker,
    }),
  });
  let routes = 0;
  const pick = (lat: number, lon: number) => {
    source.clear();
    source.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
  };
  if (options.journey) {
    for (const leg of options.journey.legs) {
      const segmentStyle = routeStyle(leg.color, leg.lineStyle === "dotted");
      if (leg.geometry && leg.geometry.coordinates.length >= 2) {
        const feature = new Feature(
          new LineString(
            leg.geometry.coordinates.map((c) => fromLonLat([c[0], c[1]])),
          ),
        );
        feature.setStyle(segmentStyle);
        source.addFeature(feature);
        routes++;
      }
      for (const [index, stop] of [leg.from, leg.to].entries())
        if (stop.lat !== null && stop.lon !== null) {
          const feature = new Feature(
            new Point(fromLonLat([stop.lon, stop.lat])),
          );
          const label = options.journey.endpointLabels?.[index];
          feature.setStyle(segmentStyle);
          if (label)
            feature.setStyle(
              new Style({
                image: segmentStyle.getImage() ?? undefined,
                text: new Text({
                  text: label,
                  offsetY: -18,
                  font: "bold 16px sans-serif",
                  fill: new Fill({ color: "#172337" }),
                  stroke: new Stroke({ color: "#fff8ee", width: 4 }),
                }),
                zIndex: 1,
              }),
            );
          source.addFeature(feature);
        }
    }
    if (source.getFeatures().length) {
      map.getView().fit(source.getExtent()!, {
        padding: [50, 50, 50, 50],
        maxZoom: options.config.mapZoom.journeyFitMax,
      });
      map
        .getView()
        .setZoom(
          (map.getView().getZoom() ?? options.config.mapZoom.journeyFitMax) +
            (options.journey.zoomOffset ??
              options.config.mapZoom.journeyOffset),
        );
    }
  } else {
    pick(options.center[1], options.center[0]);
    if (!options.readOnly)
      map.on("singleclick", (event) => {
        const [lon, lat] = toLonLat(event.coordinate);
        const normalized = ((((lon + 180) % 360) + 360) % 360) - 180;
        pick(lat, normalized);
        options.onPick?.(Number(lat.toFixed(6)), Number(normalized.toFixed(6)));
      });
  }
  return {
    pick,
    attach: (nextTarget: HTMLElement | undefined) => {
      map.setTarget(nextTarget);
      if (nextTarget) map.updateSize();
    },
    clear: () => source.clear(),
    dispose: () => {
      map.setTarget(undefined);
      map.dispose();
    },
    refresh: () => map.updateSize(),
    features: source.getFeatures().length,
    routes,
  };
}
