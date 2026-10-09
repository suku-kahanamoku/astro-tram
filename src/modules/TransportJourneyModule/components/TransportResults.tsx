import { useEffect, type RefObject } from "react";
import JourneyResults from "./JourneyResults";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import { requiresLocation } from "../../TransportCoreModule/providers/state";
import type { useJourneySearch } from "../../TransportSearchModule/hooks/useJourneySearch";
import type { useTrip } from "../hooks/useTrip";
import type { Locale } from "../../LangModule/providers/locale";
import ResultsPagination from "./ResultsPagination";
import CopyLinkButton from "../../UIModule/components/CopyLinkButton";
import StatusCard from "../../UIModule/components/StatusCard";
import { notify } from "../../UIModule/providers/notifications";
import { site } from "../../../config/site";

type SearchState = ReturnType<typeof useJourneySearch>;
type TripState = ReturnType<typeof useTrip>;

function searchError(code: string, t: Dictionary) {
  if (code === "stale_resource") return [t.staleResource, t.staleResourceHelp];
  if (code === "search_prompt") return [t.searchPrompt, ""];
  if (code === "places_unresolved") return [t.choose, t.placesError];
  if (["unsupported_coverage", "unsupported_capability"].includes(code))
    return [t.unsupported, t.unsupportedHelp];
  if (code === "nearby_stop_not_found")
    return [t.noNearbyStop, t.noNearbyStopHelp];
  if (["location", "stale_location", "stale"].includes(code))
    return [code === "location" ? t.locationError : t.stale, ""];
  if (code.startsWith("invalid")) return [t.invalid, ""];
  return [t.unavailable, t.unavailableHelp];
}

export default function TransportResults({
  results,
  locale,
  t,
  search,
  middle,
  url,
  searchUrl,
  resultsHeading,
}: {
  results: boolean;
  locale: Locale;
  t: Dictionary;
  search: SearchState;
  middle: TripState;
  url: URL;
  searchUrl: string;
  resultsHeading: RefObject<HTMLDivElement | null>;
}) {
  const error = searchError(search.error, t);
  useEffect(() => {
    if (!results || search.loading) return;
    if (search.error === "search_prompt") return;
    if (!search.error && (!search.data || search.data.journeys.length)) return;
    const [message, help] = search.error
      ? searchError(search.error, t)
      : [t.empty, t.emptyHelp];
    return notify(message, search.error ? "error" : "info", help || undefined);
  }, [results, search.loading, search.key, search.error, search.data, t]);
  const pagination =
    !search.loading && !search.error && !!search.data?.journeys.length ? (
      <ResultsPagination
        state={search.state}
        journeys={search.data.journeys}
        searchUrl={searchUrl}
        t={t}
      />
    ) : null;

  if (!results) return null;

  return (
    <section className="results-section" aria-label={t.results}>
      <div ref={resultsHeading} className="results-heading" id="results">
        <div>
          <span className="eyebrow">
            {site.name} / {t.results}
          </span>
          <h1>{t.results}</h1>
        </div>
        <CopyLinkButton
          className="button button-outline"
          data-share
          label={t.share}
          copied={t.copied}
          error={t.copyError}
          errorHelp={t.copyErrorHelp}
        />
      </div>
      {pagination && <div data-pagination-position="top">{pagination}</div>}
      <div data-results-content aria-live="polite">
        {search.loading ? (
          <StatusCard
            loading
            title={requiresLocation(search.state) ? t.locating : t.searching}
          />
        ) : search.error ? (
          <StatusCard title={error[0]} description={error[1]}>
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
          </StatusCard>
        ) : search.data?.journeys.length ? (
          <JourneyResults
            result={search.data}
            t={t}
            locale={locale}
            url={url}
            trip={middle.trip}
            tripError={middle.error}
          />
        ) : search.data ? (
          <StatusCard title={t.empty} description={t.emptyHelp} />
        ) : null}
      </div>
      {pagination && <div data-pagination-position="bottom">{pagination}</div>}
    </section>
  );
}
