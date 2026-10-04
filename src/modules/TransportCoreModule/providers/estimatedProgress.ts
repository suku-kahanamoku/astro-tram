import { validObservationInstant } from "./state";
import { transportClientConfig as config } from "../config/client";

/** Public wire projection shared by the server and HTTP/WS client boundaries. */
export function projectEstimatedProgress(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const index = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 20000;
  const id = (v: unknown): v is string =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,2048}$/.test(v);
  if (
    !index(r.from_index) ||
    !index(r.to_index) ||
    !id(r.from_stop_id) ||
    !id(r.to_stop_id) ||
    !validObservationInstant(r.from_departure) ||
    !validObservationInstant(r.to_arrival) ||
    !validObservationInstant(r.observed_at) ||
    !validObservationInstant(r.valid_until) ||
    typeof r.fraction !== "number" ||
    !Number.isFinite(r.fraction) ||
    r.fraction < 0 ||
    r.fraction > 1 ||
    typeof r.at_stop !== "boolean" ||
    (r.at_stop
      ? r.to_index !== r.from_index || r.fraction !== 0
      : r.to_index !== r.from_index + 1) ||
    Date.parse(r.valid_until) <= Date.parse(r.observed_at) ||
    Date.parse(r.valid_until) > Date.parse(r.observed_at) + config.gpsMaxAgeMs
  )
    return null;
  return {
    from_index: r.from_index,
    to_index: r.to_index,
    from_stop_id: r.from_stop_id,
    to_stop_id: r.to_stop_id,
    from_departure: r.from_departure,
    to_arrival: r.to_arrival,
    fraction: r.fraction,
    at_stop: r.at_stop,
    observed_at: r.observed_at,
    valid_until: r.valid_until,
  };
}
