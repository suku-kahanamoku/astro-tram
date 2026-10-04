import type { CSSProperties } from "react";
import { transportModes, type TransportMode } from "../config/transportModes";
import type { Dictionary } from "./translations";
import type { PlaceOption } from "../types";

export function transportMode(mode: string): TransportMode {
  return Object.hasOwn(transportModes, mode)
    ? (mode as TransportMode)
    : "transport";
}

export function modeLabel(mode: string, t: Dictionary): string {
  return t[transportModes[transportMode(mode)].label];
}

export function transportStyle(mode: string): CSSProperties {
  const presentation = transportModes[transportMode(mode)];
  return {
    "--mode-bg": presentation.background,
    "--mode-fg": presentation.foreground,
  } as CSSProperties;
}

export function countryLabel(
  state: string | null | undefined,
  t: Dictionary,
): string {
  const key = state?.toLowerCase();
  return key && ["cz", "sk", "at", "pl", "no"].includes(key)
    ? t[key as "cz" | "sk" | "at" | "pl" | "no"]
    : state === "DE"
      ? t.germany
      : (state ?? "");
}

export function placeDetail(place: PlaceOption, t: Dictionary): string {
  return [
    place.modes?.length && place.modes.every((mode) => mode === "train")
      ? t.station
      : t.stopName,
    countryLabel(place.state, t),
    place.city,
    place.transportScope === "urban"
      ? t.urbanTransport
      : place.transportScope === "regional"
        ? t.regionalTransport
        : place.transportScope === "mixed"
          ? t.mixedTransport
          : null,
    ...(place.modes ?? []).map((mode) => modeLabel(mode, t)),
    place.sourceMode === "fallback" ? t.fallback : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
