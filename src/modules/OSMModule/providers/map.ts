import Map from "ol/Map.js";
import View from "ol/View.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import OSM from "ol/source/OSM.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import MultiLineString from "ol/geom/MultiLineString.js";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj.js";
import { extend, createEmpty, isEmpty } from "ol/extent.js";
import { Style, Fill, Text, Stroke } from "ol/style.js";
import { defaults as defaultInteractions } from "ol/interaction/defaults.js";
import { defaults as defaultControls } from "ol/control/defaults.js";
import "ol/ol.css";
import "../styles/map.css";
import type {
  MapConfig,
  MapLayer,
  MapMarker,
  MapRoute,
  MapViewport,
  MapTileConfig,
} from "../types";
import { osmTiles } from "../config/map";
import {
  normalizeLongitude,
  routeSegments,
  validMapCoordinates,
} from "./coordinates";
import { routeStyle } from "./routeStyle";

export interface CreateMapOptions {
  center: [number, number];
  config: MapConfig;
  tiles?: MapTileConfig;
  zoom?: number;
  onPick?: (lat: number, lon: number) => void;
  onMarkerSelect?: (marker: MapMarker) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  journey?: MapRoute;
  markers?: readonly MapMarker[];
  readOnly?: boolean;
  zoomLabels?: { zoomIn: string; zoomOut: string };
}

export function createMap(target: HTMLElement, options: CreateMapOptions) {
  if (!validMapCoordinates(options.center[1], options.center[0]))
    throw new Error("invalid_map_center");
  const tileConfig = options.tiles ?? options.config.tiles ?? osmTiles;
  if (!tileConfig.attribution.trim())
    throw new Error("missing_map_attribution");
  const routesSource = new VectorSource();
  const markersSource = new VectorSource();
  const selectionSource = new VectorSource();
  const layers = {
    routes: new VectorLayer({ source: routesSource }),
    markers: new VectorLayer({ source: markersSource }),
    selection: new VectorLayer({
      source: selectionSource,
      style: routeStyle("#ed483b"),
    }),
  };
  const view = new View({
    center: fromLonLat(options.center),
    minZoom: options.config.minZoom ?? 2,
    maxZoom: options.config.maxZoom ?? 19,
    zoom:
      options.zoom ??
      (options.readOnly
        ? options.config.mapZoom.stop
        : options.config.mapZoom.picker),
  });
  const map = new Map({
    target,
    // Dialog focus begins on its close button, not on the map.
    interactions: defaultInteractions({ onFocusOnly: false }),
    controls: defaultControls({
      attributionOptions: { collapsible: false },
      zoomOptions: {
        zoomInTipLabel: options.zoomLabels?.zoomIn,
        zoomOutTipLabel: options.zoomLabels?.zoomOut,
      },
    }),
    layers: [
      new TileLayer({
        source: new OSM({
          url: tileConfig.url,
          attributions: tileConfig.attribution,
          maxZoom: tileConfig.maxZoom,
          referrerPolicy: "strict-origin-when-cross-origin",
        }),
        preload: 0,
      }),
      layers.routes,
      layers.markers,
      layers.selection,
    ],
    view,
  });
  if (options.zoomLabels) {
    target
      .querySelector(".ol-zoom-in")
      ?.setAttribute("aria-label", options.zoomLabels.zoomIn);
    target
      .querySelector(".ol-zoom-out")
      ?.setAttribute("aria-label", options.zoomLabels.zoomOut);
  }
  let routes = 0;
  let currentRoute = options.journey;
  let disposed = false;
  const duration = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : (options.config.animationMs ?? 250);
  const viewport = (): MapViewport => {
    const [lon, lat] = toLonLat(view.getCenter()!);
    return {
      center: [normalizeLongitude(lon), lat],
      zoom: view.getZoom()!,
      bounds: transformExtent(
        view.calculateExtent(map.getSize()),
        "EPSG:3857",
        "EPSG:4326",
      ) as MapViewport["bounds"],
    };
  };
  const fit = (animate = true) => {
    const extent = createEmpty();
    for (const layer of Object.values(layers))
      if (layer.getVisible() && layer.getSource()!.getFeatures().length)
        extend(extent, layer.getSource()!.getExtent()!);
    if (isEmpty(extent)) return false;
    view.fit(extent, {
      padding: [50, 50, 50, 50],
      maxZoom: options.config.mapZoom.journeyFitMax,
      ...(animate ? { duration: duration() } : {}),
    });
    return true;
  };
  const setRoute = (journey?: MapRoute) => {
    currentRoute = journey;
    routesSource.clear();
    routes = 0;
    for (const leg of journey?.legs ?? []) {
      const style = routeStyle(leg.color, leg.lineStyle === "dotted");
      const segments = routeSegments(leg.geometry?.coordinates ?? []);
      if (segments.length) {
        const feature = new Feature(
          new MultiLineString(
            segments.map((segment) => segment.map((c) => fromLonLat(c))),
          ),
        );
        feature.setStyle(style);
        routesSource.addFeature(feature);
        routes++;
      }
      for (const [index, point] of [leg.from, leg.to].entries()) {
        if (!validMapCoordinates(point.lat, point.lon)) continue;
        const feature = new Feature(
          new Point(fromLonLat([point.lon!, point.lat])),
        );
        const label = journey?.endpointLabels?.[index];
        feature.setStyle(
          label
            ? new Style({
                image: style.getImage() ?? undefined,
                text: new Text({
                  text: label,
                  offsetY: -18,
                  font: "bold 16px sans-serif",
                  fill: new Fill({ color: "#172337" }),
                  stroke: new Stroke({ color: "#fff8ee", width: 4 }),
                }),
                zIndex: 1,
              })
            : style,
        );
        routesSource.addFeature(feature);
      }
    }
  };
  const setMarkers = (markers: readonly MapMarker[]) => {
    markersSource.clear();
    for (const marker of markers) {
      if (!validMapCoordinates(marker.lat, marker.lon)) continue;
      const feature = new Feature(
        new Point(fromLonLat([marker.lon, marker.lat])),
      );
      feature.setId(marker.id);
      feature.set("marker", marker);
      const style = routeStyle(marker.color);
      if (marker.label)
        style.setText(
          new Text({
            text: marker.label,
            offsetY: -18,
            font: "bold 13px sans-serif",
            fill: new Fill({ color: "#172337" }),
            stroke: new Stroke({ color: "#fff8ee", width: 3 }),
          }),
        );
      feature.setStyle(style);
      markersSource.addFeature(feature);
    }
  };
  const pick = (lat: number, lon: number) => {
    if (!validMapCoordinates(lat, lon)) return;
    selectionSource.clear();
    selectionSource.addFeature(new Feature(new Point(fromLonLat([lon, lat]))));
  };
  setRoute(options.journey);
  setMarkers(options.markers ?? []);
  if (options.journey) {
    if (fit(false))
      view.setZoom(
        (view.getZoom() ?? options.config.mapZoom.journeyFitMax) +
          (options.journey.zoomOffset ?? options.config.mapZoom.journeyOffset),
      );
  } else if (!options.markers?.length)
    pick(options.center[1], options.center[0]);
  map.on("singleclick", (event) => {
    const marker = map.forEachFeatureAtPixel(
      event.pixel,
      (feature) => feature.get("marker") as MapMarker | undefined,
      { hitTolerance: 8, layerFilter: (layer) => layer === layers.markers },
    );
    if (marker) {
      options.onMarkerSelect?.(marker);
      return;
    }
    if (options.readOnly || currentRoute) return;
    const [longitude, lat] = toLonLat(event.coordinate);
    const lon = normalizeLongitude(longitude);
    if (!validMapCoordinates(lat, lon)) return;
    pick(lat, lon);
    options.onPick?.(Number(lat.toFixed(6)), Number(lon.toFixed(6)));
  });
  map.on("moveend", () => options.onViewportChange?.(viewport()));
  const resize = new ResizeObserver(() => {
    if (!disposed) map.updateSize();
  });
  resize.observe(target);
  return {
    pick,
    setRoute,
    setMarkers,
    fit,
    viewport,
    setLayerVisible: (layer: MapLayer, visible: boolean) =>
      layers[layer].setVisible(visible),
    focus: (lat: number, lon: number, zoom = view.getZoom()) => {
      if (validMapCoordinates(lat, lon))
        view.animate({
          center: fromLonLat([lon, lat]),
          zoom,
          duration: duration(),
        });
    },
    zoomBy: (delta: number) =>
      view.animate({
        zoom: (view.getZoom() ?? options.config.mapZoom.picker) + delta,
        duration: duration(),
      }),
    attach: (nextTarget: HTMLElement | undefined) => {
      resize.disconnect();
      map.setTarget(nextTarget);
      if (nextTarget) {
        resize.observe(nextTarget);
        map.updateSize();
      }
    },
    clear: () => selectionSource.clear(),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      resize.disconnect();
      map.setTarget(undefined);
      map.dispose();
    },
    refresh: () => map.updateSize(),
    get features() {
      return (
        routesSource.getFeatures().length +
        markersSource.getFeatures().length +
        selectionSource.getFeatures().length
      );
    },
    get routes() {
      return routes;
    },
  };
}
