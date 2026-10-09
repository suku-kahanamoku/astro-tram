import {
  NavLink,
  useUrlNavigation,
} from "../../UIModule/hooks/useUrlNavigation";
import TransportBadge from "../../TransportCoreModule/components/TransportBadge";
import { modeLabel } from "../../TransportCoreModule/providers/transportPresentation";
import { expandedJourneys, toggleJourney } from "../providers/journeyExpansion";
import { navHref } from "../providers/render";
import WalkMapBadge from "./WalkMapBadge";
import DelayBadge from "./DelayBadge";
import { JourneyTime, JourneyDate, JourneyDuration } from "./JourneyLiveFields";
import type { Journey } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function JourneySummary({
  journey: j,
  open,
  t,
  locale,
  url,
}: {
  journey: Journey;
  open: boolean;
  t: Dictionary;
  locale: string;
  url: URL;
}) {
  const { navigate } = useUrlNavigation();
  const selected = url.searchParams.get("journey");
  const first = j.legs[0],
    last = j.legs.at(-1)!;
  return (
    <div className="journey-summary">
      <div className="journey-summary-footer">
        <JourneyDate journey={j} locale={locale} />
        <div className="route-badges summary-badges">
          {j.legs.map((l, i) => (
            <span className="summary-leg-badges" data-mode={l.mode} key={i}>
              {l.mode === "walk" ? (
                <WalkMapBadge journey={j} index={i} url={url} t={t} />
              ) : l.tripId ? (
                <TransportBadge
                  as="button"
                  mode={l.mode}
                  line={l.line}
                  t={t}
                  className="trip-open"
                  data-summary-trip={i}
                  aria-haspopup="dialog"
                  aria-label={`${modeLabel(l.mode, t)}: ${t.tripStops} ${l.line || ""}`}
                  type="button"
                  onClick={() =>
                    navigate(
                      navHref(url, {
                        journey: j.key,
                        expanded: [...expandedJourneys(url)].join(","),
                        leg: String(i),
                        stops:
                          selected === j.key
                            ? url.searchParams.get("stops")
                            : null,
                        map: null,
                        stopLeg: null,
                        stopSide: null,
                        tripStop: null,
                      }),
                    )
                  }
                />
              ) : (
                <TransportBadge mode={l.mode} line={l.line} t={t} />
              )}
              <DelayBadge leg={l} t={t} />
              {i < j.legs.length - 1 && (
                <span className="summary-leg-arrow" aria-hidden="true">
                  ›
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
      <NavLink
        className="journey-summary-toggle"
        data-nav
        href={navHref(url, toggleJourney(url, j.key))}
        aria-expanded={open}
        aria-label={open ? t.closeDetail : t.detail}
      />
      <div className="journey-route">
        <JourneyTime
          journey={j}
          index={0}
          event="departure"
          locale={locale}
          className="journey-time"
        />
        <h3>{first.from.name}</h3>
        <JourneyTime
          journey={j}
          index={j.legs.length - 1}
          event="arrival"
          locale={locale}
          className="journey-time"
        />
        <h3>{last.to.name}</h3>
      </div>
      <JourneyDuration journey={j} t={t} />
      <span className="journey-arrow" aria-hidden="true">
        <span className="disclosure-chevron">⌄</span>
      </span>
    </div>
  );
}
