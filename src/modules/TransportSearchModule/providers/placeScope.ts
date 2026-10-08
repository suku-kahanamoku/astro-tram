import type { Fix, SearchState } from "../../TransportCoreModule/types";
import { transportClient } from "../../TransportCoreModule/providers/client";

export { rankWorldPlaces } from "../../TransportCoreModule/providers/placeRanking";

/** Country tabs are strict filters; World uses one request to the server-owned catalogue federation. */
export async function scopedPlaces(
  text: string | null,
  state: SearchState,
  countries: readonly string[],
  signal: AbortSignal,
  fix?: Fix,
) {
  if (!state.country && !countries.length) return [];
  const options = await transportClient.places(
    {
      ...(text === null ? {} : { name: { $regex: text.trim() } }),
      ...(state.country ? { state: state.country } : { scope: "world" }),
      ...(state.country && state.city ? { city: state.city } : {}),
      ...(fix
        ? { latitude: fix.lat, longitude: fix.lon, observed_at: fix.observedAt }
        : {}),
    },
    signal,
    !!fix,
  );
  signal.throwIfAborted();
  return state.country
    ? options
        .filter((p) => !p.state || p.state === state.country)
        .map((p) => ({ ...p, state: state.country }))
    : options;
}
