/** Expanded cards live in the URL; journey identifies the focused dialog/stop context. */
export function expandedJourneys(url: URL): Set<string> {
  const keys = new Set(
    (url.searchParams.get("expanded") ?? "").split(",").filter(Boolean),
  );
  if (url.searchParams.has("expanded")) return keys;
  const focused = url.searchParams.get("journey");
  if (focused) keys.add(focused);
  return keys;
}
export function toggleJourney(url: URL, key: string) {
  const keys = expandedJourneys(url);
  const closing = keys.delete(key);
  if (!closing) keys.add(key);
  return {
    expanded: keys.size ? [...keys].join(",") : null,
    journey: closing
      ? keys.has(url.searchParams.get("journey") ?? "")
        ? url.searchParams.get("journey")
        : ([...keys].at(-1) ?? null)
      : key,
    leg: null,
    stops: null,
    map: null,
    stopLeg: null,
    stopSide: null,
    tripStop: null,
  };
}
/** Preserve other expanded cards when opening a dialog from a summary badge. */
export function journeyContext(url: URL, key: string): URL {
  const next = new URL(url);
  next.searchParams.set(
    "expanded",
    [...expandedJourneys(url), key]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(","),
  );
  next.searchParams.set("journey", key);
  if (url.searchParams.get("journey") !== key)
    next.searchParams.delete("stops");
  return next;
}
