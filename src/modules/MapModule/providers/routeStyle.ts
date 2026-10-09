import { Style, Stroke, Fill, Circle as CircleStyle } from "ol/style.js";

/** Generic map receives presentation data; it has no transit mode registry. */
export function routeStyle(color?: string, dotted = false) {
  const strokeColor = color && /^#[a-f\d]{6}$/i.test(color) ? color : "#62686f";
  return new Style({
    stroke: new Stroke({
      color: strokeColor,
      width: 4,
      ...(dotted ? { lineDash: [1, 9], lineCap: "round" as const } : {}),
    }),
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: strokeColor }),
      stroke: new Stroke({ color: "#fff8ee", width: 3 }),
    }),
  });
}
