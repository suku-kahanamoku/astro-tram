import { useEffect, useState, type RefObject } from "react";
import JourneyResults from "./JourneyResults";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import {
  requiresLocation,
  writeState,
} from "../../TransportCoreModule/providers/state";
import type { useJourneySearch } from "../../TransportSearchModule/hooks/useJourneySearch";
import type { useTrip } from "../hooks/useTrip";
import type { Locale } from "../../LangModule/providers/locale";
import { adjacentJourneyPage } from "../../TransportCoreModule/providers/journeyPaging";
import Icon from "../../UIModule/components/TransitIcon";
import { notify } from "../../UIModule/providers/notifications";

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
  const [copying, setCopying] = useState(false);
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
  const pageLink = (page: "earlier" | "later") =>
    `${searchUrl}?${writeState(adjacentJourneyPage(search.state, search.data!.journeys, page))}#results`;
  const pagination =
    !search.loading && !search.error && !!search.data?.journeys.length ? (
      <nav
        className="results-pagination"
        data-pagination
        aria-label={t.results}
      >
        <a
          className="button button-outline"
          data-earlier
          href={pageLink("earlier")}
        >
          ← {t.earlier}
        </a>
        <a
          className="button button-outline"
          data-later
          href={pageLink("later")}
        >
          {t.later} →
        </a>
      </nav>
    ) : null;

  if (!results) return null;

  return (
    <section className="results-section" aria-label={t.results}>
      <div ref={resultsHeading} className="results-heading" id="results">
        <div>
          <span className="eyebrow">TRAM / {t.results}</span>
          <h1>{t.results}</h1>
        </div>
        <button
          className="button button-outline"
          type="button"
          data-share
          disabled={copying}
          aria-label={t.share}
          title={t.share}
          onClick={async () => {
            if (copying) return;
            setCopying(true);
            try {
              await navigator.clipboard.writeText(location.href);
              notify(t.copied, "success");
            } catch {
              notify(t.copyError, "error", t.copyErrorHelp);
            } finally {
              setCopying(false);
            }
          }}
        >
          <Icon name="copy" size={18} />
          <span className="share-label">{t.share}</span>
        </button>
      </div>
      {pagination && <div data-pagination-position="top">{pagination}</div>}
      <div data-results-content aria-live="polite">
        {search.loading ? (
          <div className="status-card">
            <span className="spinner" aria-hidden="true" />
            <h2>{requiresLocation(search.state) ? t.locating : t.searching}</h2>
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
            result={search.data}
            t={t}
            locale={locale}
            url={url}
            trip={middle.trip}
            tripError={middle.error}
          />
        ) : search.data ? (
          <>
            <div className="status-card">
              <h2>{t.empty}</h2>
              <p>{t.emptyHelp}</p>
            </div>
          </>
        ) : null}
      </div>
      {pagination && <div data-pagination-position="bottom">{pagination}</div>}
    </section>
  );
}
