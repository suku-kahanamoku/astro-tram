import { scopedPlaces } from "./placeScope";
import { transportClientConfig } from "../../TransportCoreModule/config/client";
import { getAutocompleteFix } from "../../TransportCoreModule/providers/geolocation";
import { selectPlace } from "../../TransportCoreModule/providers/placeSelection";
import { normalizePlaceName } from "../../TransportCoreModule/providers/placeRanking";
import type { PlaceOption, SearchState } from "../../TransportCoreModule/types";

/** The catalogue owns station roles; GPS may rank suggestions but cannot override a typed municipality. */
export function chooseTypedPlace(
  text: string,
  state: SearchState,
  options: readonly PlaceOption[],
) {
  const query = normalizePlaceName(text);
  const municipality = !state.city
    ? options.find(
        (option) =>
          option.kind === "city" && normalizePlaceName(option.name) === query,
      )
    : undefined;
  if (municipality) return municipality;
  const station = !state.city
    ? options.find(
        (option) =>
          option.cityStation &&
          option.kind === "stop" &&
          option.matchedCity &&
          normalizePlaceName(option.matchedCity) === query,
      )
    : undefined;
  return station ?? options[0];
}

/** One shared query policy for suggestions and resolving unselected text on submit. */
export async function placeSuggestions(
  text: string,
  state: SearchState,
  signal: AbortSignal,
  countries: readonly string[] = [],
) {
  const fix = await getAutocompleteFix();
  signal.throwIfAborted();
  return scopedPlaces(text, state, countries, signal, fix);
}

export async function resolveTypedPlace(
  text: string,
  state: SearchState,
  signal: AbortSignal,
  countries: readonly string[] = [],
) {
  if (text.trim().length < transportClientConfig.minimumQueryLength) return;
  const options = await placeSuggestions(text, state, signal, countries);
  const option = chooseTypedPlace(text, state, options);
  const place = option && selectPlace(option);
  return place ? { place, option } : undefined;
}
