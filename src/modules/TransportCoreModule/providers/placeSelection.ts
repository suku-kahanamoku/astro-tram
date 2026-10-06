import type { Place, PlaceOption } from "../types";
import { validCoordinates } from "./state";

/** Wire geography kinds are independent of the backend (Lucene, Photon or online API). */
export function selectPlace(option: PlaceOption): Place | undefined {
  if (!option.kind || option.kind === "stop")
    return { type: "stop", id: option.id, label: option.name };
  if (
    typeof option.lat !== "number" ||
    typeof option.lon !== "number" ||
    !validCoordinates(option.lat, option.lon)
  )
    return undefined;
  return {
    type: "coordinates",
    lat: option.lat,
    lon: option.lon,
    label: option.name,
  };
}
