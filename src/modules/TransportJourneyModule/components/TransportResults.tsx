import { useState, type RefObject } from "react";
import JourneyResults from "./JourneyResults";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import {
  requiresLocation,
  writeState,
} from "../../TransportCoreModule/providers/state";
import type { useJourneySearch } from "../../TransportSearchModule/hooks/useJourneySearch";
import type { useTrip } from "../hooks/useTrip";
import type { Locale } from "../../LangModule/providers/locale";

type SearchState = ReturnType<typeof useJourneySearch>;
type TripState = ReturnType<typeof useTrip>;

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
  const [share, setShare] = useState("");
  const error = searchError(search.error, t);
  const pageLink = (delta: number) =>
    `${searchUrl}?${writeState({ ...search.state, at: new Date(Date.parse(search.state.at!) + delta * 60000).toISOString().replace(".000Z", "Z") })}`;

  if (!results) return null;

  return (
    <section className="results-section" aria-label={t.results}>
      <div ref={resultsHeading} className="results-heading">
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
      {search.state.at && (
        <div className="results-pagination" data-pagination>
          <a
            className="button button-outline"
            data-earlier
            href={pageLink(-60)}
          >
            ← {t.earlier}
          </a>
          <a className="button button-outline" data-later href={pageLink(60)}>
            {t.later} →
          </a>
        </div>
      )}
    </section>
  );
}
