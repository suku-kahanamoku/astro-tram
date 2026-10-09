import { TripCallTime } from "./JourneyLiveFields";
import { Fragment, memo, useMemo } from "react";
import StopLabel from "./StopLabel";
import { tripSegment } from "../providers/trip";
import {
  hasStopDetails,
  navHref,
  scheduledCallTime,
} from "../providers/render";
import type { Trip, Leg } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
function TripStops({
  trip,
  t,
  locale,
  leg,
  current,
  stopOffset = 0,
  totalStops = trip.stops.length,
  timeline = false,
  referenceTime = trip.stops[0]
    ? scheduledCallTime(trip.stops[0], "departure")
    : undefined,
}: {
  trip: Trip;
  t: Dictionary;
  locale: string;
  leg?: Leg;
  current?: URL;
  stopOffset?: number;
  totalStops?: number;
  timeline?: boolean;
  referenceTime?: string | null;
}) {
  const kmFormat = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }),
    [locale],
  );
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
        const href = current
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
            ? `${kmFormat.format(c.routeKm)} km`
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
            <TripCallTime
              call={c}
              locale={locale}
              event={index === totalStops - 1 ? "arrival" : "departure"}
              referenceTime={referenceTime}
            />
            <span className="trip-stop-name">
              <StopLabel
                stop={c.stop}
                t={t}
                requestStop={c.requestStop}
                href={href}
                linkAttributes={{ "data-trip-stop-map": index }}
              />
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
