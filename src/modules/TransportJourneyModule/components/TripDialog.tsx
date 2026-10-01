import DelayBadge from "./DelayBadge";
import type { TripObservation } from "../../TransportCoreModule/types";
import Dialog from "../../UIModule/components/Dialog";
import Icon from "../../UIModule/components/TransitIcon";
import { modeLabel } from "../providers/transportIcons";
import { hasStopDetails } from "../providers/render";
import TripTimeline from "./TripTimeline";
import TripLegend from "./TripLegend";
import type { Trip, Leg } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function TripDialog({
  live,
  open,
  leg,
  trip,
  error,
  t,
  locale,
  url,
  onClose,
}: {
  live?: TripObservation;
  open: boolean;
  leg?: Leg;
  trip?: Trip;
  error?: string;
  t: Dictionary;
  locale: string;
  url: URL;
  onClose: () => void;
}) {
  const from = trip?.stops[0]?.stop.name,
    to = trip?.stops.at(-1)?.stop.name;
  return (
    <Dialog
      open={open}
      onDismiss={onClose}
      className="map-dialog trip-dialog"
      data-trip-dialog
      aria-labelledby="trip-title"
    >
      <div className="map-header trip-sticky-header">
        <div>
          <span className="eyebrow">TRAM / {t.tripStops}</span>
          <h2 id="trip-title">
            {leg ? (
              <>
                <span className="trip-title-service">
                  {leg.line || modeLabel(leg.mode, t)} <Icon name={leg.mode} />
                </span>
                {from && to && (
                  <span className="trip-title-route">
                    {from} – {to}
                  </span>
                )}
              </>
            ) : (
              t.tripStops
            )}
          </h2>
          {leg && <DelayBadge leg={leg} live={live} t={t} />}
        </div>
        <button
          className="icon-button"
          type="button"
          data-close-trip
          aria-label={t.close}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="trip-summary-header">
        {trip && leg && !error && (
          <div data-trip-legend aria-label={t.tripInfo}>
            <TripLegend
              trip={trip}
              leg={leg}
              t={t}
              locale={locale}
              section="summary"
            />
          </div>
        )}
      </div>
      <div className="trip-body" aria-busy={!trip && !error}>
        {trip?.stops.some((c) => c.requestStop) && (
          <p className="trip-stop-legend" data-trip-stop-legend>
            <abbr className="request-stop" title={t.requestStop}>
              z
            </abbr>
            {t.requestStopLegend.slice(1)}
          </p>
        )}
        {trip && hasStopDetails(trip) && (
          <div
            className="trip-columns has-timeline"
            data-trip-columns
            aria-hidden="true"
          >
            <span>{t.time}</span>
            <span>{t.stopName}</span>
            <span>{t.tariffZones}</span>
            <span title={t.routeKmHint}>{t.routeKm}</span>
          </div>
        )}
        {trip && !error && trip.stops.length ? (
          <TripTimeline
            trip={trip}
            live={live}
            leg={leg}
            t={t}
            locale={locale}
            url={url}
          />
        ) : (
          <ul className="trip-stops" data-trip-dialog-stops aria-live="polite">
            <li className={!trip && !error ? "trip-loading" : undefined}>
              {!trip && !error && (
                <span className="spinner" aria-hidden="true" />
              )}
              {error ? t.tripError : !trip ? t.loadingTrip : t.noTripStops}
            </li>
          </ul>
        )}
      </div>
      {trip && leg && !error && (
        <div data-trip-notes>
          <TripLegend
            trip={trip}
            leg={leg}
            t={t}
            locale={locale}
            section="notes"
          />
        </div>
      )}
    </Dialog>
  );
}
