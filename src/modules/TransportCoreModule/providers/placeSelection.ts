import type { Place, PlaceOption } from "../types";
import { validCoordinates } from "./state";

/** Wire geography kinds are independent of the backend (Lucene, Photon or online API). */
export function selectPlace(option: PlaceOption): Place | undefined {
  const country =
    option.state && /^[A-Z]{2}$/.test(option.state)
      ? { state: option.state }
      : {};
  if (!option.kind || option.kind === "stop")
    return { type: "stop", id: option.id, label: option.name, ...country };
  if (option.kind === "city" && !country.state) return undefined;
  if (
    typeof option.lat !== "number" ||
    typeof option.lon !== "number" ||
    !validCoordinates(option.lat, option.lon)
  )
    return undefined;
  return {
    ...(option.kind === "city"
      ? { type: "municipality" as const, id: option.id }
      : { type: "coordinates" as const }),
    lat: option.lat,
    lon: option.lon,
    label: option.name,
    ...country,
  };
}
