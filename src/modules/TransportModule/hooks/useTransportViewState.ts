import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import { expandedJourneys } from "../../TransportJourneyModule/providers/journeyExpansion";
import { useJourneySearch } from "../../TransportSearchModule/hooks/useJourneySearch";
import { useTripTracking } from "../../TransportTrackingModule/hooks/useTripTracking";
import { useTrip } from "../../TransportJourneyModule/hooks/useTrip";

export function useTransportViewState(results: boolean) {
  const { url, navigate } = useUrlNavigation();
  const search = useJourneySearch(results);
  const parameters = url.searchParams;
  const selected = search.data?.journeys.find(
    (journey) => journey.key === parameters.get("journey"),
  );
  const index = (name: string) => {
    const value = parameters.get(name);
    return value !== null && /^\d+$/.test(value) ? Number(value) : -1;
  };
  const modalLeg = selected?.legs[index("leg")];
  const middleLeg = selected?.legs[index("stops")];
  const tracking = useTripTracking([
    ...(search.data?.journeys
      .filter((journey) => expandedJourneys(url).has(journey.key))
      .flatMap((journey) =>
        journey.legs.flatMap((leg) => (leg.tripId ? [leg.tripId] : [])),
      ) ?? []),
    ...(modalLeg?.tripId ? [modalLeg.tripId] : []),
  ]);
  const mode = parameters.get("map");
  const isTripMap = mode === "stop" && parameters.has("tripStop");
  const modalOpen = !!modalLeg?.tripId && (!mode || isTripMap);
  const mapLeg =
    selected?.legs[
      isTripMap && parameters.has("leg") ? index("leg") : index("stopLeg")
    ];
  const middleResource = useTrip(middleLeg?.tripId);
  const separateModalResource = useTrip(
    modalOpen && modalLeg?.tripId !== middleLeg?.tripId
      ? modalLeg?.tripId
      : undefined,
  );
  const modalResource =
    modalLeg?.tripId && modalLeg.tripId === middleLeg?.tripId
      ? middleResource
      : separateModalResource;
  const extraResource = useTrip(
    isTripMap &&
      mapLeg?.tripId !== modalLeg?.tripId &&
      mapLeg?.tripId !== middleLeg?.tripId
      ? mapLeg?.tripId
      : undefined,
  );
  const mapResource =
    mapLeg?.tripId === modalLeg?.tripId
      ? modalResource
      : mapLeg?.tripId === middleLeg?.tripId
        ? middleResource
        : extraResource;
  const stop = isTripMap
    ? mapResource.trip?.stops[index("tripStop")]?.stop
    : parameters.get("stopSide") === "from"
      ? mapLeg?.from
      : parameters.get("stopSide") === "to"
        ? mapLeg?.to
        : undefined;
  const place =
    mode === "from" || mode === "to" ? search.state[mode] : undefined;
  const mapOpen =
    mode === "from" || mode === "to"
      ? !!place
      : (mode === "journey" || mode === "stop") && !!selected;

  return {
    url,
    navigate,
    parameters,
    search,
    selected,
    index,
    modalLeg,
    middleLeg,
    tracking,
    mode,
    isTripMap,
    modalOpen,
    mapLeg,
    middleResource,
    modalResource,
    mapResource,
    stop,
    place,
    mapOpen,
  };
}
