import { writeState } from "../../TransportCoreModule/providers/state";
import { adjacentJourneyPage } from "../../TransportCoreModule/providers/journeyPaging";
import type { SearchState, Journey } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function ResultsPagination({
  state,
  journeys,
  searchUrl,
  t,
}: {
  state: SearchState;
  journeys: Journey[];
  searchUrl: string;
  t: Dictionary;
}) {
  const pageLink = (page: "earlier" | "later") =>
    `${searchUrl}?${writeState(adjacentJourneyPage(state, journeys, page))}#results`;
  return (
    <nav className="results-pagination" data-pagination aria-label={t.results}>
      <a
        className="button button-outline"
        data-earlier
        href={pageLink("earlier")}
      >
        ← {t.earlier}
      </a>
      <a className="button button-outline" data-later href={pageLink("later")}>
        {t.later} →
      </a>
    </nav>
  );
}
