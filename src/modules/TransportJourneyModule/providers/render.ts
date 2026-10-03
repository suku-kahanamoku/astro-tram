import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import type { Journey, Trip, TripStop } from "../../TransportCoreModule/types";
export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function time(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export const date = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
    new Date(value),
  );
export function duration(seconds: number, t: Dictionary) {
  const mins = Math.round(seconds / 60);
  return mins >= 60
    ? `${Math.floor(mins / 60)} ${t.hours} ${mins % 60 ? `${mins % 60} ${t.minutes}` : ""}`
    : `${mins} ${t.minutes}`;
}
/** The displayed itinerary is the timetable, independent of live predictions. */
export function scheduledDuration(journey: Journey) {
  const first = journey.legs[0],
    last = journey.legs.at(-1);
  return first && last
    ? Math.max(
        0,
        (Date.parse(last.scheduledArrival) -
          Date.parse(first.scheduledDeparture)) /
          1000,
      )
    : journey.duration;
}
export function scheduledCallTime(
  call: TripStop,
  event: "arrival" | "departure",
) {
  return call[event] ?? call[event === "arrival" ? "departure" : "arrival"];
}
export function navHref(current: URL, params: Record<string, string | null>) {
  const u = new URL(current);
  for (const [k, v] of Object.entries(params))
    v === null ? u.searchParams.delete(k) : u.searchParams.set(k, v);
  return u.pathname + u.search;
}
export function hasStopDetails(trip: Trip) {
  return trip.stops.some(
    (c) => !!c.tariffZones?.length || typeof c.routeKm === "number",
  );
}
