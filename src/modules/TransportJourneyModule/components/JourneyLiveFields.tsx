import {
  useJourneyTiming,
  usePredictionExpiry,
  useTripObservation,
} from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import { callTime } from "../../TransportTrackingModule/providers/tracking";
import { date, time, duration } from "../providers/render";
import type { Journey, TripStop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
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
  return risk ? (
    <p className="notice journey-risk-slot" role="status">
      {t.transferAtRisk}
    </p>
  ) : null;
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
  return <time>{display.value ? time(display.value, locale) : "—"}</time>;
}
