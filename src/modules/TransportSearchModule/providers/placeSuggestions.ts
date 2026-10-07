import { scopedPlaces } from "./placeScope";
import { transportClientConfig } from "../../TransportCoreModule/config/client";
import { getAutocompleteFix } from "../../TransportCoreModule/providers/geolocation";
import { selectPlace } from "../../TransportCoreModule/providers/placeSelection";
import type { SearchState } from "../../TransportCoreModule/types";

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
  const option = options[0];
  const place = option && selectPlace(option);
  return place ? { place, option } : undefined;
}
