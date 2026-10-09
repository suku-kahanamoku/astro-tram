import type { Fix, PlaceOption } from "../types";

export const normalizePlaceName = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
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
  const term = text === null ? null : normalizePlaceName(text);
  const relevance = (option: PlaceOption) => {
    if (term === null) return 0;
    const name = normalizePlaceName(option.name);
    const stop = name.split(",").at(-1)!.trim();
    return name === term || stop === term
      ? 0
      : name.startsWith(term) || stop.startsWith(term)
        ? 1
        : 2;
  };
  const priority = (option: PlaceOption) =>
    !option.kind || option.kind === "stop"
      ? 0
      : option.kind === "street"
        ? 1
        : 2;
  const stationPriority = (option: PlaceOption) =>
    option.cityStation &&
    term !== null &&
    option.matchedCity &&
    normalizePlaceName(option.matchedCity) === term
      ? (option.stationPriority ?? 2)
      : 3;
  const unique = [
    ...new Map(options.map((option) => [option.id, option])).values(),
  ];
  return unique
    .sort(
      (a, b) =>
        stationPriority(a) - stationPriority(b) ||
        priority(a) - priority(b) ||
        relevance(a) - relevance(b) ||
        distance(a, fix) - distance(b, fix) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 20);
}
