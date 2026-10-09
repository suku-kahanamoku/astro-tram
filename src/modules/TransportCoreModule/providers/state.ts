import type { Fix, Place, SearchState } from "../types";
import { journeyPaging } from "../config/journeyPaging";
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
/** Source observation timestamps may include fractional seconds (RFC 3339). */
export function validObservationInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    validInstant(value.replace(/\.\d{1,9}(?=Z$|[+-]\d{2}:\d{2}$)/, ""))
  );
}
export function readState(params: URLSearchParams): SearchState {
  const read = (side: string): Place | undefined => {
    const state = params.get(`${side}State`);
    const country = state && /^[A-Z]{2}$/.test(state) ? { state } : {};
    const kind = params.get(`${side}Kind`),
      label = (params.get(`${side}Label`) ?? "").slice(0, 160);
    if (kind === "current_location") return { type: kind, label };
    if (kind === "coordinates") {
      const la = params.get(`${side}Lat`),
        lo = params.get(`${side}Lon`);
      if (la && lo && validCoordinates(Number(la), Number(lo)))
        return {
          type: kind,
          lat: Number(la),
          lon: Number(lo),
          label,
          ...country,
        };
      return;
    }
    const id = params.get(side);
    if (id && /^[A-Za-z0-9_-]{1,2048}$/.test(id))
      return { type: "stop", id, label, ...country };
  };
  const at = params.get("at");
  return {
    ...(params.get("dayMode") === "today"
      ? ({ dayMode: "today" } as const)
      : {}),
    ...(params.get("timeMode") === "now" ? ({ timeMode: "now" } as const) : {}),
    ...(params.get("areaMode") === "gps" ? ({ areaMode: "gps" } as const) : {}),
    ...(params.get("page") === "earlier" || params.get("page") === "later"
      ? { page: params.get("page") as "earlier" | "later" }
      : {}),
    ...(params.get("scope") !== "world" && params.get("city")?.trim()
      ? { city: params.get("city")!.trim().slice(0, 120) }
      : {}),
    from: read("from"),
    to: read("to"),
    ...(!read("from") && params.get("fromText")?.trim()
      ? { fromText: params.get("fromText")!.trim().slice(0, 160) }
      : {}),
    ...(!read("to") && params.get("toText")?.trim()
      ? { toText: params.get("toText")!.trim().slice(0, 160) }
      : {}),
    at: validInstant(at) ? at : undefined,
    arrive: params.get("arrive") === "1",
    direct: params.get("direct") === "1",
    country:
      params.get("scope") === "world"
        ? ""
        : /^[A-Z]{2}$/.test(params.get("country") ?? "")
          ? params.get("country")!
          : "CZ",
  };
}
/** GPS coordinates and observation times never enter URLs or browser storage. */
export function writeState(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  for (const side of ["from", "to"] as const) {
    const place = state[side];
    if (!place) {
      const text = state[`${side}Text`]?.trim().slice(0, 160);
      if (text) p.set(`${side}Text`, text);
      continue;
    }
    p.set(`${side}Kind`, place.type);
    if (
      place.type !== "current_location" &&
      place.state &&
      /^[A-Z]{2}$/.test(place.state)
    )
      p.set(`${side}State`, place.state);
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
  else p.set("scope", "world");
  if (state.country && state.city) p.set("city", state.city);
  if (state.page) p.set("page", state.page);
  if (state.dayMode) p.set("dayMode", state.dayMode);
  if (state.timeMode) p.set("timeMode", state.timeMode);
  if (state.areaMode) p.set("areaMode", state.areaMode);
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
  const country = state.country || state.from?.state || state.to?.state;
  return {
    "from-dest": place(state.from),
    "to-dest": place(state.to),
    [(state.page ? state.page === "earlier" : state.arrive)
      ? "to-date"
      : "from-date"]: state.at,
    ...(country ? { state: country } : {}),
    ...(state.country && state.city ? { city: state.city } : {}),
    "max-transfers": state.direct ? 0 : 5,
    limit: journeyPaging.size,
  };
}
export const requiresLocation = (state: SearchState) =>
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
