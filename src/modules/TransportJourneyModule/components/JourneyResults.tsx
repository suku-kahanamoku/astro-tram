import {
  expandedJourneys,
  toggleJourney,
  journeyContext,
} from "../providers/journeyExpansion";
import DelayBadge from "./DelayBadge";
import {
  JourneyTime,
  JourneyDuration,
  JourneyDate,
  JourneyRisk,
} from "./JourneyLiveFields";
import { Fragment } from "react";
import Collapse from "../../UIModule/components/Collapse";
import {
  NavLink,
  useUrlNavigation,
} from "../../UIModule/hooks/useUrlNavigation";
import Icon from "../../UIModule/components/TransitIcon";
import { modeLabel } from "../providers/transportIcons";
import { navHref } from "../providers/render";
import { tripSegment } from "../providers/trip";
import TripStops from "./TripStops";
import type {
  SearchResult,
  Journey,
  Leg,
  Stop,
  Trip,
} from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
function Badge({ leg, t }: { leg: Leg; t: Dictionary }) {
  return (
    <>
      {leg.mode === "walk" ? t.walk : leg.line || modeLabel(leg.mode, t)}
      <Icon name={leg.mode} />
      {leg.mode !== "walk" && (
        <span className="sr-only"> {modeLabel(leg.mode, t)}</span>
      )}
    </>
  );
}
function StopLink({
  stop,
  index,
  side,
  url,
  t,
}: {
  stop: Stop;
  index: number;
  side: string;
  url: URL;
  t: Dictionary;
}) {
  return (
    <>
      {stop.id || (stop.lat !== null && stop.lon !== null) ? (
        <NavLink
          className="stop-map-link"
          data-stop-map={`${index}-${side}`}
          data-nav
          aria-haspopup="dialog"
          href={navHref(url, {
            map: "stop",
            stopLeg: String(index),
            stopSide: side,
            leg: null,
            tripStop: null,
          })}
        >
          {stop.name}
        </NavLink>
      ) : (
        stop.name
      )}
      {stop.platform && (
        <>
          {" "}
          <small>
            · {t.platform} {stop.platform}
          </small>
        </>
      )}
    </>
  );
}
function JourneyDetail({
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
        const expanded = focused && url.searchParams.get("stops") === String(i);
        const segment = expanded && trip ? tripSegment(trip, l) : null;
        return (
          <Fragment key={i}>
            <JourneyRisk journey={journey} index={i} t={t} />
            <article className="leg">
              <div className="leg-title" data-mode={l.mode}>
                {l.tripId ? (
                  <NavLink
                    className="route-badge trip-open"
                    data-mode={l.mode}
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
                  >
                    <Badge leg={l} t={t} />
                  </NavLink>
                ) : (
                  <span className="route-badge" data-mode={l.mode}>
                    <Badge leg={l} t={t} />
                  </span>
                )}
                <DelayBadge leg={l} t={t} />
                {l.operator && (
                  <strong className="leg-operator">{l.operator}</strong>
                )}
                {l.cancelled && <span className="fallback">{t.cancelled}</span>}
              </div>
              <div className="leg-stops">
                <JourneyTime
                  journey={journey}
                  index={i}
                  event="departure"
                  locale={locale}
                />
                <div>
                  <StopLink
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
                          <li>{t.tripError}</li>
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
                />
                <div>
                  <StopLink stop={l.to} index={i} side="to" url={url} t={t} />
                </div>
              </div>
            </article>
          </Fragment>
        );
      })}
    </section>
  );
}
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
  const { navigate } = useUrlNavigation();
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
      {result.journeys.map((j) => {
        const first = j.legs[0],
          last = j.legs.at(-1)!,
          open = expandedJourneys(url).has(j.key);
        return (
          <article
            className={`journey-card ${open ? "is-open" : ""}`}
            data-journey={j.key}
            key={j.key}
          >
            <div className="journey-summary">
              <div className="journey-summary-footer">
                <JourneyDate journey={j} locale={locale} />
                <div className="route-badges summary-badges">
                  {j.legs.map((l, i) => (
                    <Fragment key={i}>
                      {i > 0 && <span aria-hidden="true">›</span>}
                      <span className="summary-leg-badges" data-mode={l.mode}>
                        {l.tripId ? (
                          <button
                            className="route-badge trip-open"
                            data-mode={l.mode}
                            data-summary-trip={i}
                            aria-haspopup="dialog"
                            aria-label={`${modeLabel(l.mode, t)}: ${t.tripStops} ${l.line || ""}`}
                            type="button"
                            onClick={() =>
                              navigate(
                                navHref(url, {
                                  journey: j.key,
                                  expanded: [...expandedJourneys(url)].join(
                                    ",",
                                  ),
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
                          >
                            <Badge leg={l} t={t} />
                          </button>
                        ) : (
                          <span className="route-badge" data-mode={l.mode}>
                            <Badge leg={l} t={t} />
                          </span>
                        )}
                        <DelayBadge leg={l} t={t} />
                      </span>
                    </Fragment>
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
            {(j.source.mode === "fallback" ||
              j.legs.some((l) => l.cancelled)) && (
              <div className="journey-meta">
                <span
                  className={j.source.mode === "fallback" ? "fallback" : ""}
                >
                  {j.source.mode === "fallback" ? t.fallback : t.cancelled}
                  {j.source.mode === "fallback" &&
                  j.legs.some((l) => l.cancelled)
                    ? ` · ${t.cancelled}`
                    : ""}
                </span>
                {j.source.mode === "fallback" && (
                  <span>{j.source.attribution || j.source.provider}</span>
                )}
              </div>
            )}
            <Collapse open={open}>
              <JourneyDetail
                journey={j}
                t={t}
                locale={locale}
                url={url}
                trip={trip}
                tripError={tripError}
              />
            </Collapse>
          </article>
        );
      })}
    </>
  );
}
