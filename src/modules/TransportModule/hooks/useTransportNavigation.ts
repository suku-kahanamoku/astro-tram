import { useEffect, useRef } from "react";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { expandedJourneys } from "../../TransportJourneyModule/providers/journeyExpansion";
import {
  readState,
  validCoordinates,
  writeState,
} from "../../TransportCoreModule/providers/state";
import { navHref } from "../../TransportJourneyModule/providers/render";
import type { useTrip } from "../../TransportJourneyModule/hooks/useTrip";
import type { Journey } from "../../TransportCoreModule/types";

type TripResource = ReturnType<typeof useTrip>;

export function useTransportNavigation({
  url,
  navigate,
  parameters,
  selected,
  index,
  mode,
  t,
  mapOpen,
  modalResource,
  middleResource,
}: {
  url: URL;
  navigate: (href: string, replace?: boolean) => void;
  parameters: URLSearchParams;
  selected?: Journey;
  index: (name: string) => number;
  mode: string | null;
  t: Dictionary;
  mapOpen: boolean;
  modalResource: TripResource;
  middleResource: TripResource;
}) {
  const resultsHeading = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusAfter.current && !mapOpen) {
      const target = root.current?.querySelector<HTMLElement>(
        focusAfter.current,
      );
      if (target) {
        target.focus({ preventScroll: true });
        focusAfter.current = null;
      }
    }
  }, [url.href, mapOpen, modalResource.trip, middleResource.trip]);

  const focusedCard = `[data-journey="${selected?.key}"]`;
  const closeMap = () => {
    const tripStop = parameters.get("tripStop");
    focusAfter.current =
      tripStop !== null && /^\d+$/.test(tripStop)
        ? `${parameters.has("leg") ? "[data-trip-dialog]" : focusedCard} [data-trip-stop-map="${tripStop}"]`
        : /^\d+$/.test(parameters.get("stopLeg") ?? "") &&
            ["from", "to"].includes(parameters.get("stopSide") ?? "")
          ? `${focusedCard} [data-stop-map="${parameters.get("stopLeg")}-${parameters.get("stopSide")}"]`
          : null;
    navigate(
      navHref(url, {
        map: null,
        tripStop: null,
        stopLeg: null,
        stopSide: null,
      }),
      true,
    );
  };
  const closeTrip = () => {
    focusAfter.current = `${focusedCard} [${selected && expandedJourneys(url).has(selected.key) ? "data-trip-open" : "data-summary-trip"}="${index("leg")}"]`;
    navigate(navHref(url, { leg: null }), true);
  };
  const selectPoint = (lat: number, lon: number) => {
    if (!validCoordinates(lat, lon) || (mode !== "from" && mode !== "to"))
      return;
    const state = readState(parameters);
    state[mode] = {
      type: "coordinates",
      lat,
      lon,
      label: `${t.mapPoint} (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    };
    navigate(`${url.pathname}?${writeState(state)}${url.hash}`, true);
  };

  return { resultsHeading, root, closeMap, closeTrip, selectPoint };
}
