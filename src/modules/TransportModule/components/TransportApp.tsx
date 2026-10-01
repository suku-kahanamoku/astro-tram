import { trackedJourney } from "../providers/tracking";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  UrlNavigationProvider,
  useUrlNavigation,
} from "../../UIModule/hooks/useUrlNavigation";
import { dictionary, type Dictionary } from "../providers/translations";
import {
  readState,
  writeState,
  validCoordinates,
  requiresLocation,
} from "../providers/state";
import { navHref } from "../providers/render";
import { useJourneySearch } from "../hooks/useJourneySearch";
import { useTripTracking } from "../hooks/useTripTracking";
import { useTrip } from "../hooks/useTrip";
import SearchForm from "./SearchForm";
import JourneyResults, { ResolvedPlaces } from "./JourneyResults";
import TripDialog from "./TripDialog";
import MapDialog from "./MapDialog";
import type { Locale } from "../../LangModule/providers/locale";
interface Props {
  locale: Locale;
  results: boolean;
  initialUrl: string;
  searchUrl: string;
}
function searchError(code: string, t: Dictionary) {
  if (code === "search_prompt") return [t.searchPrompt, ""];
  if (["unsupported_coverage", "unsupported_capability"].includes(code))
    return [t.unsupported, t.unsupportedHelp];
  if (code === "nearby_stop_not_found")
    return [t.noNearbyStop, t.noNearbyStopHelp];
  if (["location", "stale_location", "stale"].includes(code))
    return [code === "location" ? t.locationError : t.stale, ""];
  if (code.startsWith("invalid")) return [t.invalid, ""];
  return [t.unavailable, t.unavailableHelp];
}
function TransportView({
  locale,
  results,
  searchUrl,
}: Omit<Props, "initialUrl">) {
  const t = dictionary(locale);
  const { url, navigate } = useUrlNavigation();
  const search = useJourneySearch(results);
  const p = url.searchParams;
  const selectedOriginal = search.data?.journeys.find(
    (j) => j.key === p.get("journey"),
  );
  const tracking = useTripTracking(
    selectedOriginal?.legs.flatMap((l) => (l.tripId ? [l.tripId] : [])) ?? [],
  );
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!search.data) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [search.data]);
  const displayed = useMemo(() => {
    if (!search.data) return undefined;
    const journeys = search.data.journeys.map((j) =>
      trackedJourney(j, tracking, clock),
    );
    journeys.sort((a, b) => {
      if (!!a.transferAtRisk !== !!b.transferAtRisk)
        return a.transferAtRisk ? 1 : -1;
      if (search.state.arrive) {
        const firstA = a.legs[0],
          firstB = b.legs[0];
        return (
          Date.parse(firstB.expectedDeparture ?? firstB.scheduledDeparture) -
          Date.parse(firstA.expectedDeparture ?? firstA.scheduledDeparture)
        );
      }
      const lastA = a.legs.at(-1)!,
        lastB = b.legs.at(-1)!;
      return (
        Date.parse(lastA.expectedArrival ?? lastA.scheduledArrival) -
        Date.parse(lastB.expectedArrival ?? lastB.scheduledArrival)
      );
    });
    return { ...search.data, journeys };
  }, [search.data, search.state.arrive, tracking, clock]);
  const selected = displayed?.journeys.find((j) => j.key === p.get("journey"));
  const index = (name: string) => {
    const v = p.get(name);
    return v !== null && /^\d+$/.test(v) ? Number(v) : -1;
  };
  const modalLeg = selected?.legs[index("leg")],
    middleLeg = selected?.legs[index("stops")];
  const mode = p.get("map");
  const isTripMap = mode === "stop" && p.has("tripStop");
  const modalOpen = !!modalLeg?.tripId && (!mode || isTripMap);
  const mapLeg =
    selected?.legs[isTripMap && p.has("leg") ? index("leg") : index("stopLeg")];
  // Keep an expanded stop list alive while its trip dialog is opened.
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
  const middle = middleResource;
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
        ? middle
        : extraResource;
  const stop = isTripMap
    ? mapResource.trip?.stops[index("tripStop")]?.stop
    : p.get("stopSide") === "from"
      ? mapLeg?.from
      : p.get("stopSide") === "to"
        ? mapLeg?.to
        : undefined;
  const place =
    mode === "from" || mode === "to" ? search.state[mode] : undefined;
  const mapOpen =
    mode === "from" || mode === "to"
      ? !!place
      : (mode === "journey" || mode === "stop") && !!selected;
  const focusAfter = useRef<string | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focusAfter.current && !mapOpen) {
      const target = root.current?.querySelector<HTMLElement>(
        focusAfter.current,
      );
      if (target) {
        target.focus();
        focusAfter.current = null;
      }
    }
  }, [url.href, mapOpen, modalResource.trip, middle.trip]);
  const closeMap = () => {
    const tripStop = p.get("tripStop");
    focusAfter.current =
      tripStop !== null && /^\d+$/.test(tripStop)
        ? `[data-trip-stop-map="${tripStop}"]`
        : /^\d+$/.test(p.get("stopLeg") ?? "") &&
            ["from", "to"].includes(p.get("stopSide") ?? "")
          ? `[data-stop-map="${p.get("stopLeg")}-${p.get("stopSide")}"]`
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
  const [share, setShare] = useState("");
  const error = searchError(search.error, t);
  const pageLink = (delta: number) =>
    `${searchUrl}?${writeState({ ...search.state, at: new Date(Date.parse(search.state.at!) + delta * 60000).toISOString().replace(".000Z", "Z") })}`;
  return (
    <section
      ref={root}
      className={`search-section shell ${results ? "is-results" : ""}`}
      id="search"
      data-transport
      data-ready="true"
      data-locale={locale}
      data-results={String(results)}
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.subtitle}</p>
      </div>
      <SearchForm t={t} searchUrl={searchUrl} />
      {results && (
        <section className="results-section" aria-label={t.results}>
          <div className="results-heading">
            <div>
              <span className="eyebrow">TRAM / {t.results}</span>
              <h1>{t.results}</h1>
              <p>{t.resultsSub}</p>
            </div>
            <button
              className="button button-outline"
              type="button"
              data-share
              onClick={() =>
                void navigator.clipboard
                  .writeText(location.href)
                  .then(() => setShare(t.copied))
                  .catch(() => setShare(t.copyError))
              }
            >
              {share || t.share}
            </button>
          </div>
          <div data-results-content aria-live="polite">
            {search.loading ? (
              <div className="status-card">
                <span className="spinner" aria-hidden="true" />
                <h2>
                  {requiresLocation(search.state) ? t.locating : t.searching}
                </h2>
              </div>
            ) : search.error ? (
              <div className="status-card">
                <h2>{error[0]}</h2>
                <p>{error[1]}</p>
                {search.error !== "search_prompt" && (
                  <button
                    className="button"
                    data-retry
                    type="button"
                    onClick={search.retry}
                  >
                    {t.retry} ↻
                  </button>
                )}
              </div>
            ) : search.data?.journeys.length ? (
              <JourneyResults
                tracking={tracking}
                result={displayed ?? search.data}
                t={t}
                locale={locale}
                url={url}
                trip={middle.trip}
                tripError={middle.error}
              />
            ) : search.data ? (
              <>
                <ResolvedPlaces result={displayed ?? search.data} t={t} />
                <div className="status-card">
                  <h2>{t.empty}</h2>
                  <p>{t.emptyHelp}</p>
                </div>
              </>
            ) : null}
          </div>
          <div
            className="results-pagination"
            data-pagination
            hidden={!search.state.at}
          >
            <a
              className="button button-outline"
              data-earlier
              href={search.state.at ? pageLink(-60) : "#"}
            >
              ← {t.earlier}
            </a>
            <a
              className="button button-outline"
              data-later
              href={search.state.at ? pageLink(60) : "#"}
            >
              {t.later} →
            </a>
          </div>
        </section>
      )}
      <TripDialog
        live={modalLeg?.tripId ? tracking[modalLeg.tripId] : undefined}
        open={modalOpen}
        leg={modalLeg}
        trip={modalResource.trip}
        error={modalResource.error}
        t={t}
        locale={locale}
        url={url}
        onClose={() => {
          focusAfter.current = `[data-trip-open="${index("leg")}"]`;
          navigate(navHref(url, { leg: null }), true);
        }}
      />
      <MapDialog
        open={mapOpen}
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
        journey={selectedOriginal}
        country={search.state.country}
        t={t}
        onClose={closeMap}
        onPoint={(lat, lon) => {
          if (!validCoordinates(lat, lon) || (mode !== "from" && mode !== "to"))
            return;
          const state = readState(p);
          state[mode] = {
            type: "coordinates",
            lat,
            lon,
            label: `${t.mapPoint} (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          };
          navigate(`${url.pathname}?${writeState(state)}`, true);
        }}
      />
    </section>
  );
}
export default function TransportApp(props: Props) {
  return (
    <UrlNavigationProvider initialUrl={props.initialUrl}>
      <TransportView {...props} />
    </UrlNavigationProvider>
  );
}
