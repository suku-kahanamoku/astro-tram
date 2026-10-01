import Dialog from "../../UIModule/components/Dialog";
import Icon from "../../UIModule/components/TransitIcon";
import { modeLabel } from "../providers/transportIcons";
import { hasStopDetails } from "../providers/render";
import TripStops from "./TripStops";
import TripLegend from "./TripLegend";
import type { Trip, Leg } from "../types";
import type { Dictionary } from "../providers/translations";
export default function TripDialog({
  open,
  leg,
  trip,
  error,
  t,
  locale,
  url,
  onClose,
}: {
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
      <div className="map-header">
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
      <div data-trip-legend aria-label={t.tripInfo} hidden={!trip || !!error}>
        {trip && leg && !error && (
          <TripLegend
            trip={trip}
            leg={leg}
            t={t}
            locale={locale}
            section="summary"
          />
        )}
      </div>
      <div className="trip-body" aria-busy={!trip && !error}>
        <p
          className="trip-stop-legend"
          data-trip-stop-legend
          hidden={!trip?.stops.some((c) => c.requestStop)}
        >
          {t.requestStopLegend}
        </p>
        <div
          className="trip-columns"
          data-trip-columns
          hidden={!trip || !hasStopDetails(trip)}
          aria-hidden="true"
        >
          <span>{t.time}</span>
          <span>{t.stopName}</span>
          <span>{t.tariffZones}</span>
          <span title={t.routeKmHint}>{t.routeKm}</span>
        </div>
        <ul className="trip-stops" data-trip-dialog-stops aria-live="polite">
          {error ? (
            <li>{t.tripError}</li>
          ) : !trip ? (
            <li className="trip-loading">
              <span className="spinner" aria-hidden="true" />
              {t.loadingTrip}
            </li>
          ) : trip.stops.length ? (
            <TripStops
              trip={trip}
              leg={leg}
              t={t}
              locale={locale}
              current={url}
            />
          ) : (
            <li>{t.noTripStops}</li>
          )}
        </ul>
      </div>
      <div data-trip-notes hidden={!trip || !!error}>
        {trip && leg && !error && (
          <TripLegend
            trip={trip}
            leg={leg}
            t={t}
            locale={locale}
            section="notes"
          />
        )}
      </div>
    </Dialog>
  );
}
