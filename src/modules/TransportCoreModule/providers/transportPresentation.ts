import type { CSSProperties } from "react";
import { transportModes, type TransportMode } from "../config/transportModes";
import type { Dictionary } from "./translations";
import type { PlaceOption } from "../types";
import { modePalette, type TransportPalette } from "./transportPalette";

export function transportMode(mode: string): TransportMode {
  return Object.hasOwn(transportModes, mode)
    ? (mode as TransportMode)
    : "transport";
}

export function modeLabel(mode: string, t: Dictionary): string {
  return t[transportModes[transportMode(mode)].label];
}

export function transportStyle(
  mode: string,
  palette: TransportPalette,
): CSSProperties {
  const presentation = modePalette(palette, mode);
  if (!presentation) return {};
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

export function placeLocationDetail(
  place: Pick<
    PlaceOption,
    "state" | "city" | "citySource" | "region" | "district"
  >,
  t: Dictionary,
): string {
  const values = [
    countryLabel(place.state, t),
    place.region,
    place.district,
    place.citySource === "nearest_settlement" && place.city
      ? t.nearCity.replace("{city}", place.city)
      : place.city,
  ];
  const seen = new Set<string>();
  return values
    .filter((value): value is string => {
      if (!value?.trim()) return false;
      const key = value.trim().normalize("NFC").toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" · ");
}

export function placeDetail(place: PlaceOption, t: Dictionary): string {
  return [
    place.kind === "street"
      ? t.street
      : place.kind === "address"
        ? t.address
        : place.kind === "city"
          ? t.municipalityTransport
          : place.modes?.length && place.modes.every((mode) => mode === "train")
            ? t.station
            : t.stopName,
    placeLocationDetail(place, t),
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
