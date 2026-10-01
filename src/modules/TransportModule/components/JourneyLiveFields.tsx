import {
  useJourneyTiming,
  usePredictionExpiry,
  useTripObservation,
} from "../hooks/useTrackingSnapshot";
import { callTime } from "../providers/tracking";
import { date, time, duration } from "../providers/render";
import type { Journey, TripStop } from "../types";
import type { Dictionary } from "../providers/translations";
type Props = { journey: Journey; locale: string; t: Dictionary };
export function JourneyTime({
  journey,
  index,
  event,
  locale,
  className,
}: {
  journey: Journey;
  index: number;
  event: "departure" | "arrival";
  locale: string;
  className?: string;
}) {
  const leg = useJourneyTiming(journey).legs[index];
  const value =
    event === "departure"
      ? (leg.expectedDeparture ?? leg.scheduledDeparture)
      : (leg.expectedArrival ?? leg.scheduledArrival);
  return (
    <time className={className} dateTime={value}>
      {time(value, locale)}
    </time>
  );
}
export function JourneyDuration({ journey, t }: Omit<Props, "locale">) {
  const timed = useJourneyTiming(journey);
  return (
    <div className="journey-duration">
      {timed.transferAtRisk ? t.connectionAtRisk : duration(timed.duration, t)}
      <small>
        {journey.transfers
          ? `${journey.transfers} ${journey.transfers === 1 ? t.transfer : t.transfers}`
          : t.directLabel}
      </small>
    </div>
  );
}
export function JourneyDate({ journey, locale }: Omit<Props, "t">) {
  const first = useJourneyTiming(journey).legs[0];
  return (
    <small className="journey-date">
      {date(first.expectedDeparture ?? first.scheduledDeparture, locale)}
    </small>
  );
}
export function JourneyRisk({ journey, t }: Omit<Props, "locale">) {
  const risk = useJourneyTiming(journey).transferAtRisk;
  return (
    <p
      className="notice journey-risk-slot"
      role={risk ? "status" : undefined}
      aria-hidden={!risk}
      style={{ visibility: risk ? "visible" : "hidden" }}
    >
      {t.transferAtRisk}
    </p>
  );
}
export function JourneyLegInfo({
  journey,
  index,
  locale,
  t,
}: Props & { index: number }) {
  const leg = useJourneyTiming(journey).legs[index];
  const departure = leg.expectedDeparture ?? leg.scheduledDeparture;
  const arrival = leg.expectedArrival ?? leg.scheduledArrival;
  return (
    <p className="leg-info">
      {date(departure, locale)}
      {date(departure, locale) !== date(arrival, locale)
        ? ` → ${date(arrival, locale)}`
        : ""}{" "}
      · {leg.realtime ? t.live : t.scheduled}
      {leg.expectedDeparture && leg.expectedDeparture !== leg.scheduledDeparture
        ? ` · ${t.scheduled} ${time(leg.scheduledDeparture, locale)}`
        : ""}
    </p>
  );
}
export function TripCallTime({
  call,
  tripId,
  locale,
}: {
  call: TripStop;
  tripId?: string | null;
  locale: string;
}) {
  const live = useTripObservation(tripId);
  usePredictionExpiry([call.predictionValidUntil]);
  const display = callTime(
    call,
    call.departure ? "departure" : "arrival",
    live,
  );
  return (
    <time>
      <span
        className="time-estimate"
        aria-hidden="true"
        style={{ visibility: display.estimated ? "visible" : "hidden" }}
      >
        ≈{" "}
      </span>
      {display.value ? time(display.value, locale) : "—"}
    </time>
  );
}
