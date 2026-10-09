import TripServiceBadge from "./TripServiceBadge";
import type { TripObservation } from "../../TransportCoreModule/types";
import Dialog from "../../UIModule/components/Dialog";
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
  referenceTime,
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
  referenceTime?: string | null;
}) {
  const from = trip?.stops[0]?.stop.name,
    to = trip?.stops.at(-1)?.stop.name;
  return (
    <Dialog
      open={open}
      onDismiss={onClose}
      className="trip-dialog"
      scrollContent
      data-trip-dialog
      titleId="trip-title"
      closeLabel={t.close}
      closeButtonAttributes={{ "data-close-trip": true }}
      title={
        leg ? (
          <>
            <TripServiceBadge
              leg={leg}
              live={live}
              t={t}
              className="trip-title-service"
            />
            {from && to && (
              <span className="trip-title-route">
                {from} – {to}
              </span>
            )}
          </>
        ) : (
          t.tripStops
        )
      }
    >
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
            referenceTime={referenceTime ?? leg?.scheduledDeparture}
          />
        ) : (
          <ul className="trip-stops" data-trip-dialog-stops aria-live="polite">
            <li className={!trip && !error ? "trip-loading" : undefined}>
              {!trip && !error && (
                <span className="spinner" aria-hidden="true" />
              )}
              {error
                ? error === "stale_resource"
                  ? t.staleResourceHelp
                  : t.tripError
                : !trip
                  ? t.loadingTrip
                  : t.noTripStops}
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
