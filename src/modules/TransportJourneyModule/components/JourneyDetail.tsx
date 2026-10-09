import { Fragment } from "react";
import Collapse from "../../UIModule/components/Collapse";
import { NavLink } from "../../UIModule/hooks/useUrlNavigation";
import Icon from "../../UIModule/components/TransitIcon";
import { modeLabel } from "../../TransportCoreModule/providers/transportPresentation";
import { journeyContext } from "../providers/journeyExpansion";
import { navHref } from "../providers/render";
import { tripSegment } from "../providers/trip";
import WalkMapBadge from "./WalkMapBadge";
import JourneyStopLink from "./JourneyStopLink";
import JourneyLegPosition from "./JourneyLegPosition";
import TripServiceBadge from "./TripServiceBadge";
import TripStops from "./TripStops";
import { JourneyTime } from "./JourneyLiveFields";
import { JourneyRiskProvider, JourneyRiskNotice } from "./JourneyRisks";
import type { Journey, Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function JourneyDetail({
  journey,
  t,
  locale,
  url,
  trip,
  tripError,
}: {
  journey: Journey;
  t: Dictionary;
  locale: string;
  url: URL;
  trip?: Trip;
  tripError?: string;
}) {
  const focused = url.searchParams.get("journey") === journey.key;
  url = journeyContext(url, journey.key);
  return (
    <JourneyRiskProvider journey={journey}>
      <section className="journey-detail" aria-label={t.detail}>
        <div className="detail-heading">
          <h3>{t.detail}</h3>
          <NavLink
            data-nav
            aria-haspopup="dialog"
            href={navHref(url, {
              map: "journey",
              leg: null,
              stopLeg: null,
              stopSide: null,
              tripStop: null,
            })}
          >
            {t.routeMap} <Icon name="map" size={16} />
          </NavLink>
        </div>
        {journey.legs.map((l, i) => {
          const expanded =
            focused && url.searchParams.get("stops") === String(i);
          const segment = expanded && trip ? tripSegment(trip, l) : null;
          return (
            <Fragment key={i}>
              <JourneyRiskNotice index={i} t={t} />
              <article className="leg">
                <div className="leg-title" data-mode={l.mode}>
                  {l.mode === "walk" ? (
                    <WalkMapBadge journey={journey} index={i} url={url} t={t} />
                  ) : l.tripId ? (
                    <TripServiceBadge
                      as={NavLink}
                      leg={l}
                      t={t}
                      className="trip-open"
                      data-trip-open={i}
                      data-nav
                      aria-haspopup="dialog"
                      aria-label={`${t.tripStops} ${l.line || modeLabel(l.mode, t)}`}
                      href={navHref(url, {
                        leg: String(i),
                        map: null,
                        stopLeg: null,
                        stopSide: null,
                        tripStop: null,
                      })}
                    />
                  ) : (
                    <TripServiceBadge leg={l} t={t} />
                  )}
                  {l.operator && (
                    <strong className="leg-operator">{l.operator}</strong>
                  )}
                  {l.cancelled && (
                    <span className="fallback">{t.cancelled}</span>
                  )}
                </div>
                <JourneyLegPosition leg={l} t={t} expanded={!!segment}>
                  <JourneyTime
                    journey={journey}
                    index={i}
                    event="departure"
                    locale={locale}
                    timelinePoint={segment?.from ?? 0}
                  />
                  <div>
                    <JourneyStopLink
                      stop={l.from}
                      index={i}
                      side="from"
                      url={url}
                      t={t}
                    />
                  </div>
                  {l.tripId && (
                    <div className="intermediate-stops">
                      <NavLink
                        data-nav
                        className="intermediate-toggle"
                        href={navHref(url, {
                          stops: expanded ? null : String(i),
                        })}
                        aria-expanded={expanded}
                        aria-controls={`intermediate-${journey.key}-${i}`}
                      >
                        {t.intermediateStops}{" "}
                        <span className="disclosure-mark" aria-hidden="true" />
                      </NavLink>
                      <Collapse open={expanded}>
                        <ul
                          id={`intermediate-${journey.key}-${i}`}
                          className="trip-stops"
                          data-intermediate-stops={i}
                          aria-live="polite"
                        >
                          {tripError ? (
                            <li>
                              {tripError === "stale_resource"
                                ? t.staleResourceHelp
                                : t.tripError}
                            </li>
                          ) : !trip ? (
                            <li>{t.loadingTrip}</li>
                          ) : !segment ? (
                            <li>{t.segmentUnavailable}</li>
                          ) : segment.to - segment.from === 1 ? (
                            <li>{t.noIntermediateStops}</li>
                          ) : (
                            <TripStops
                              trip={{
                                ...trip,
                                stops: trip.stops.slice(
                                  segment.from + 1,
                                  segment.to,
                                ),
                              }}
                              t={t}
                              locale={locale}
                              current={url}
                              stopOffset={segment.from + 1}
                              totalStops={trip.stops.length}
                              referenceTime={
                                journey.legs[0]?.scheduledDeparture
                              }
                              timeline
                            />
                          )}
                        </ul>
                      </Collapse>
                    </div>
                  )}
                  <JourneyTime
                    journey={journey}
                    index={i}
                    event="arrival"
                    locale={locale}
                    timelinePoint={segment?.to ?? 1}
                  />
                  <div>
                    <JourneyStopLink
                      stop={l.to}
                      index={i}
                      side="to"
                      url={url}
                      t={t}
                    />
                  </div>
                </JourneyLegPosition>
              </article>
            </Fragment>
          );
        })}
      </section>
    </JourneyRiskProvider>
  );
}
