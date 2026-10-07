import type {
  Fix,
  PlaceOption,
  SearchState,
} from "../../TransportCoreModule/types";
import { transportClient } from "../../TransportCoreModule/providers/client";

const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
const radians = (value: number) => (value * Math.PI) / 180;
function distance(option: PlaceOption, fix?: Fix) {
  if (!fix || typeof option.lat !== "number" || typeof option.lon !== "number")
    return Infinity;
  return (
    Math.sin(radians(option.lat - fix.lat) / 2) ** 2 +
    Math.cos(radians(fix.lat)) *
      Math.cos(radians(option.lat)) *
      Math.sin(radians(option.lon - fix.lon) / 2) ** 2
  );
}

/** Merge already ranked national catalogues; exact transit names precede geography and partial matches. */
export function rankWorldPlaces(
  options: PlaceOption[],
  text: string | null,
  fix?: Fix,
) {
  const term = text === null ? null : normalize(text.trim());
  const relevance = (option: PlaceOption) => {
    if (term === null) return 0;
    const name = normalize(option.name);
    const stop = name.split(",").at(-1)!.trim();
    return name === term || stop === term
      ? 0
      : name.startsWith(term) || stop.startsWith(term)
        ? 1
        : 2;
  };
  const transit = (option: PlaceOption) =>
    !option.kind || option.kind === "stop" ? 0 : 1;
  const unique = [
    ...new Map(options.map((option) => [option.id, option])).values(),
  ];
  return unique
    .sort(
      (a, b) =>
        transit(a) - transit(b) ||
        relevance(a) - relevance(b) ||
        distance(a, fix) - distance(b, fix) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 20);
}

/** Country tabs are strict filters; World fans out only to capabilities advertised by the backend. */
export async function scopedPlaces(
  text: string | null,
  state: SearchState,
  countries: readonly string[],
  signal: AbortSignal,
  fix?: Fix,
) {
  const scopes = state.country
    ? [state.country]
    : [...new Set(countries.filter((c) => /^[A-Z]{2}$/.test(c)))];
  const results = await Promise.allSettled(
    scopes.map(async (country) => {
      const options = await transportClient.places(
        {
          ...(text === null ? {} : { name: { $regex: text.trim() } }),
          state: country,
          ...(state.country && state.city ? { city: state.city } : {}),
          ...(fix
            ? {
                latitude: fix.lat,
                longitude: fix.lon,
                observed_at: fix.observedAt,
              }
            : {}),
        },
        signal,
        !!fix,
      );
      return options
        .filter((p) => !p.state || p.state === country)
        .map((p) => ({ ...p, state: country }));
    }),
  );
  signal.throwIfAborted();
  const successful = results.filter((r) => r.status === "fulfilled");
  if (!successful.length && results.length)
    throw (results[0] as PromiseRejectedResult).reason;
  const options = successful.flatMap((r) => r.value);
  return state.country ? options : rankWorldPlaces(options, text, fix);
}
