import { TripCallTime } from "./JourneyLiveFields";
import { Fragment, memo } from "react";
import { NavLink } from "../../UIModule/hooks/useUrlNavigation";
import { tripSegment } from "../providers/trip";
import { hasStopDetails, navHref } from "../providers/render";
import type { Trip, Leg } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
function TripStops({
  trip,
  tripId,
  t,
  locale,
  leg,
  current,
  stopOffset = 0,
  timeline = false,
}: {
  trip: Trip;
  tripId?: string | null;
  t: Dictionary;
  locale: string;
  leg?: Leg;
  current?: URL;
  stopOffset?: number;
  timeline?: boolean;
}) {
  const segment = leg ? tripSegment(trip, leg) : null,
    details = hasStopDetails(trip);
  return (
    <>
      {trip.sourceMode === "fallback" && (
        <li className="notice">{t.fallback}</li>
      )}
      {trip.stops.map((c, i) => {
        const index = i + stopOffset,
          selected = segment !== null && i >= segment.from && i <= segment.to;
        const href =
          current && (c.stop.id || (c.stop.lat !== null && c.stop.lon !== null))
            ? navHref(current, {
                map: "stop",
                tripStop: String(index),
                stopLeg: current.searchParams.has("leg")
                  ? null
                  : current.searchParams.get("stops"),
                stopSide: null,
              })
            : null;
        const km =
          typeof c.routeKm === "number" &&
          Number.isFinite(c.routeKm) &&
          c.routeKm >= 0
            ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(c.routeKm)} km`
            : "—";
        return (
          <li
            key={`${c.stop.id}:${index}`}
            className={`trip-call ${details ? "has-details" : ""}${selected ? " is-selected-segment" : ""}`}
            data-timeline-start={timeline && i === 0 ? true : undefined}
            data-timeline-end={
              timeline && i === trip.stops.length - 1 ? true : undefined
            }
          >
            {timeline && (
              <span
                className="trip-axis-point"
                data-trip-point={index}
                aria-hidden="true"
              />
            )}
            <TripCallTime call={c} tripId={tripId} locale={locale} />
            <span className="trip-stop-name">
              {href ? (
                <NavLink
                  className="stop-map-link"
                  data-trip-stop-map={index}
                  data-nav
                  aria-haspopup="dialog"
                  href={href}
                >
                  {c.stop.name}
                </NavLink>
              ) : (
                c.stop.name
              )}
              {c.requestStop && (
                <>
                  {" "}
                  <abbr
                    className="request-stop"
                    title={t.requestStop}
                    aria-label={t.requestStop}
                  >
                    z
                  </abbr>
                </>
              )}
              {c.stop.platform && (
                <>
                  {" "}
                  <small>
                    · {t.platform} {c.stop.platform}
                  </small>
                </>
              )}
            </span>
            {details && (
              <>
                <span className="trip-stop-zones">
                  <span className="sr-only">{t.tariffZones}: </span>
                  {c.tariffZones?.length
                    ? c.tariffZones.map((z, j) => (
                        <Fragment key={`${z.system}:${z.zone}:${j}`}>
                          {j > 0 ? " / " : ""}
                          <span
                            title={[z.system, z.zone]
                              .filter(Boolean)
                              .join(" · ")}
                          >
                            {z.zone}
                          </span>
                        </Fragment>
                      ))
                    : "—"}
                </span>
                <span className="trip-stop-km" title={t.routeKmHint}>
                  <span className="sr-only">{t.routeKm}: </span>
                  {km}
                </span>
              </>
            )}
          </li>
        );
      })}
    </>
  );
}

export default memo(TripStops);
