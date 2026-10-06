import { transportClient } from "../../TransportCoreModule/providers/client";
import { transportClientConfig } from "../../TransportCoreModule/config/client";
import { getAutocompleteFix } from "../../TransportCoreModule/providers/geolocation";
import { selectPlace } from "../../TransportCoreModule/providers/placeSelection";
import type { SearchState } from "../../TransportCoreModule/types";

/** One shared query policy for suggestions and resolving unselected text on submit. */
export async function placeSuggestions(
  text: string,
  state: SearchState,
  signal: AbortSignal,
) {
  const fix = await getAutocompleteFix();
  signal.throwIfAborted();
  const automaticArea = state.areaMode === "gps" && !!fix;
  return transportClient.places(
    {
      name: { $regex: text.trim() },
      ...(!automaticArea && state.country ? { state: state.country } : {}),
      ...(!automaticArea && state.city ? { city: state.city } : {}),
      ...(fix
        ? { latitude: fix.lat, longitude: fix.lon, observed_at: fix.observedAt }
        : {}),
    },
    signal,
    !!fix,
  );
}

export async function resolveTypedPlace(
  text: string,
  state: SearchState,
  signal: AbortSignal,
) {
  if (text.trim().length < transportClientConfig.minimumQueryLength) return;
  const options = await placeSuggestions(text, state, signal);
  const option = options[0];
  const place = option && selectPlace(option);
  return place ? { place, option } : undefined;
}
