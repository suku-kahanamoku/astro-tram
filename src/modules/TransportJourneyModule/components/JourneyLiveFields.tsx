import { useJourneyTiming } from "../../TransportTrackingModule/hooks/useTrackingSnapshot";
import {
  date,
  time,
  duration,
  scheduledDuration,
  scheduledCallTime,
} from "../providers/render";
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
  const leg = journey.legs[index];
  const value =
    event === "departure" ? leg.scheduledDeparture : leg.scheduledArrival;
  return (
    <time className={className} dateTime={value}>
      {time(value, locale)}
    </time>
  );
}
export function JourneyDuration({ journey, t }: Omit<Props, "locale">) {
  return (
    <div className="journey-duration">
      {duration(scheduledDuration(journey), t)}
      <small>
        {journey.transfers
          ? `${journey.transfers} ${journey.transfers === 1 ? t.transfer : t.transfers}`
          : t.directLabel}
      </small>
    </div>
  );
}
export function JourneyDate({ journey, locale }: Omit<Props, "t">) {
  const first = journey.legs[0];
  return (
    <small className="journey-date">
      {date(first.scheduledDeparture, locale)}
    </small>
  );
}
export function JourneyRisk({
  journey,
  index,
  t,
}: Omit<Props, "locale"> & { index: number }) {
  const risk = useJourneyTiming(journey).transferRiskLegs.includes(index);
  return risk ? (
    <p
      className="notice transfer-risk-notice"
      role="status"
      data-transfer-risk={index}
    >
      {t.transferAtRisk}
    </p>
  ) : null;
}
export function TripCallTime({
  call,
  locale,
  event = "departure",
}: {
  call: TripStop;
  locale: string;
  event?: "arrival" | "departure";
}) {
  const value = scheduledCallTime(call, event);
  return (
    <time dateTime={value ?? undefined}>
      {value ? time(value, locale) : "—"}
    </time>
  );
}
