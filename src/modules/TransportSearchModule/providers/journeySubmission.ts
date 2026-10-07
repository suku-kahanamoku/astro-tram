import { transportClient } from "../../TransportCoreModule/providers/client";
import { searchBody } from "../../TransportCoreModule/providers/state";
import type { Fix, SearchState } from "../../TransportCoreModule/types";

/** World keeps the existing country router: resolve the origin's country, never rewrite the selected tab. */
export async function journeySubmission(
  state: SearchState,
  signal: AbortSignal,
  fix?: Fix,
) {
  const body = searchBody(state, fix);
  if (state.country || state.from?.state) return body;
  const origin =
    state.from?.type === "current_location"
      ? fix
      : state.from?.type === "coordinates"
        ? {
            lat: state.from.lat,
            lon: state.from.lon,
            observedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
          }
        : undefined;
  if (origin) {
    const stops = await transportClient.places(
      {
        latitude: origin.lat,
        longitude: origin.lon,
        observed_at: origin.observedAt,
      },
      signal,
      true,
    );
    signal.throwIfAborted();
    const country = stops.find(
      (stop) => stop.state && /^[A-Z]{2}$/.test(stop.state),
    )?.state;
    if (country) body.state = country;
  }
  return body;
}
