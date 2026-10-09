import { expandedJourneys } from "../providers/journeyExpansion";
import JourneyCard from "./JourneyCard";
import type { SearchResult, Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function JourneyResults({
  result,
  t,
  locale,
  url,
  trip,
  tripError,
}: {
  result: SearchResult;
  t: Dictionary;
  locale: string;
  url: URL;
  trip?: Trip;
  tripError?: string;
}) {
  const expanded = expandedJourneys(url);
  const selected = url.searchParams.get("journey");
  return (
    <>
      {result.partial && <p className="notice">{t.partial}</p>}
      {selected && !result.journeys.some((j) => j.key === selected) && (
        <p className="notice">{t.missingJourney}</p>
      )}
      <p className="results-count">
        {result.journeys.length} {t.found}
      </p>
      {result.journeys.map((journey) => (
        <JourneyCard
          key={journey.key}
          journey={journey}
          open={expanded.has(journey.key)}
          t={t}
          locale={locale}
          url={url}
          trip={trip}
          tripError={tripError}
        />
      ))}
    </>
  );
}
