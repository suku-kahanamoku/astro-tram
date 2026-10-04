import { useScrollOnContent } from "../../UIModule/hooks/useScrollOnContent";
import { TripResources } from "../../TransportJourneyModule/hooks/TripResources";
import { TrackingContext } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import {
  UrlNavigationProvider,
  LocalNavigationProvider,
} from "../../UIModule/hooks/useUrlNavigation";
import { dictionary } from "../../TransportCoreModule/providers/translations";
import { useTransportViewState } from "../hooks/useTransportViewState";
import { useTransportNavigation } from "../hooks/useTransportNavigation";
import TransportSearchSection from "../../TransportSearchModule/components/TransportSearchSection";
import TransportResults from "../../TransportJourneyModule/components/TransportResults";
import TransportOverlays from "./TransportOverlays";
import type { Locale } from "../../LangModule/providers/locale";
interface Props {
  locale: Locale;
  results: boolean;
  initialUrl: string;
  searchUrl: string;
}
function TransportView({
  locale,
  results,
  searchUrl,
}: Omit<Props, "initialUrl">) {
  const t = dictionary(locale);
  const {
    url,
    navigate,
    parameters: p,
    search,
    selected,
    index,
    modalLeg,
    tracking,
    mode,
    isTripMap,
    modalOpen,
    mapLeg,
    mapJourney,
    middleResource,
    modalResource,
    mapResource,
    stop,
    place,
    mapOpen,
  } = useTransportViewState(results);
  const middle = middleResource;
  const { resultsHeading, root, closeMap, closeTrip, selectPoint } =
    useTransportNavigation({
      url,
      navigate,
      parameters: p,
      selected,
      index,
      mode,
      t,
      mapOpen,
      modalResource,
      middleResource,
    });
  useScrollOnContent(
    resultsHeading,
    search.loading ? null : search.data,
    modalOpen || mapOpen,
  );
  return (
    <TrackingContext.Provider value={tracking}>
      <section
        ref={root}
        className={`search-section shell ${results ? "is-results" : ""}`}
        id="search"
        data-transport
        data-ready="true"
        data-locale={locale}
        data-results={String(results)}
      >
        <TransportSearchSection t={t} searchUrl={searchUrl} />
        <TransportResults
          results={results}
          locale={locale}
          t={t}
          search={search}
          middle={middle}
          url={url}
          searchUrl={searchUrl}
          resultsHeading={resultsHeading}
        />
        <TransportOverlays
          modalOpen={modalOpen}
          modalLeg={modalLeg}
          journeyStart={selected?.legs[0]?.scheduledDeparture}
          modalResource={modalResource}
          locale={locale}
          t={t}
          url={url}
          onTripClose={closeTrip}
          mapOpen={mapOpen}
          identity={`${mode}:${selected?.key}:${index("stopLeg")}:${p.get("stopSide")}:${p.get("leg")}:${p.get("tripStop")}:${JSON.stringify(place)}`}
          mode={mode}
          place={place}
          stop={stop}
          waiting={
            isTripMap &&
            !!mapLeg?.tripId &&
            !mapResource.trip &&
            !mapResource.error
          }
          journey={mapJourney}
          country={search.state.country}
          onMapClose={closeMap}
          onPoint={selectPoint}
        />
      </section>
    </TrackingContext.Provider>
  );
}
const interactionParameters = [
  "journey",
  "expanded",
  "leg",
  "stops",
  "map",
  "stopLeg",
  "stopSide",
  "tripStop",
] as const;
export default function TransportApp(props: Props) {
  return (
    <UrlNavigationProvider initialUrl={props.initialUrl}>
      <LocalNavigationProvider parameters={interactionParameters}>
        <TripResources>
          <TransportView {...props} />
        </TripResources>
      </LocalNavigationProvider>
    </UrlNavigationProvider>
  );
}
