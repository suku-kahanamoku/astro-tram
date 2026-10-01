import type { Fix, Place, SearchState } from "../types";
export function validCoordinates(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}
export function validInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function readState(params: URLSearchParams): SearchState {
  const read = (side: string): Place | undefined => {
    const kind = params.get(`${side}Kind`),
      label = (params.get(`${side}Label`) ?? "").slice(0, 160);
    if (kind === "current_location") return { type: kind, label };
    if (kind === "coordinates") {
      const la = params.get(`${side}Lat`),
        lo = params.get(`${side}Lon`);
      if (la && lo && validCoordinates(Number(la), Number(lo)))
        return { type: kind, lat: Number(la), lon: Number(lo), label };
      return;
    }
    const id = params.get(side);
    if (id && /^[A-Za-z0-9_-]{1,2048}$/.test(id))
      return { type: "stop", id, label };
  };
  const at = params.get("at");
  return {
    ...(params.get("city")?.trim()
      ? { city: params.get("city")!.trim().slice(0, 120) }
      : {}),
    ...(params.get("scopeLocation") === "1" ? { scopeLocation: true } : {}),
    from: read("from"),
    to: read("to"),
    at: validInstant(at) ? at : undefined,
    arrive: params.get("arrive") === "1",
    direct: params.get("direct") === "1",
    country: /^[A-Z]{2}$/.test(params.get("country") ?? "")
      ? params.get("country")!
      : "CZ",
  };
}
/** GPS coordinates and observation times never enter URLs or browser storage. */
export function writeState(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  for (const side of ["from", "to"] as const) {
    const place = state[side];
    if (!place) continue;
    p.set(`${side}Kind`, place.type);
    if (place.type === "stop") {
      p.set(side, place.id);
      p.set(`${side}Label`, place.label);
    }
    if (place.type === "coordinates") {
      p.set(`${side}Lat`, String(place.lat));
      p.set(`${side}Lon`, String(place.lon));
      p.set(`${side}Label`, place.label);
    }
  }
  if (state.at) p.set("at", state.at);
  if (state.arrive) p.set("arrive", "1");
  if (state.direct) p.set("direct", "1");
  if (state.country) p.set("country", state.country);
  if (state.city) p.set("city", state.city);
  if (state.scopeLocation) p.set("scopeLocation", "1");
  return p;
}
export function searchBody(
  state: SearchState,
  fix?: Fix,
): Record<string, unknown> {
  const place = (value?: Place) => {
    if (!value) throw new Error("invalid");
    if (value.type === "stop") return { type: "stop", id: value.id };
    if (value.type === "coordinates")
      return { type: value.type, lat: value.lat, lon: value.lon };
    if (
      !fix ||
      !validInstant(fix.observedAt) ||
      Date.now() - Date.parse(fix.observedAt) > 30000 ||
      Date.parse(fix.observedAt) - Date.now() > 5000
    )
      throw new Error("stale");
    return {
      type: "current_location",
      lat: fix.lat,
      lon: fix.lon,
      "observed-at": fix.observedAt,
    };
  };
  if (!validInstant(state.at)) throw new Error("invalid");
  return {
    "from-dest": place(state.from),
    "to-dest": place(state.to),
    [state.arrive ? "to-date" : "from-date"]: state.at,
    ...(state.country ? { state: state.country } : {}),
    ...(state.city ? { city: state.city } : {}),
    ...(state.scopeLocation && !state.city
      ? { location: place({ type: "current_location", label: "" }) }
      : {}),
    "max-transfers": state.direct ? 0 : 5,
    limit: 10,
  };
}
export const requiresLocation = (state: SearchState) =>
  (!!state.scopeLocation && !state.city) ||
  state.from?.type === "current_location" ||
  state.to?.type === "current_location";
export function localFields(instant: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`,
    time: `${pad(instant.getHours())}:${pad(instant.getMinutes())}`,
  };
}
export function formInstant(day: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time))
    throw new Error("invalid");
  const d = new Date(`${day}T${time}:00`);
  const fields = localFields(d);
  if (
    !Number.isFinite(d.getTime()) ||
    fields.day !== day ||
    fields.time !== time
  )
    throw new Error("invalid");
  return d.toISOString().replace(".000Z", "Z");
}
