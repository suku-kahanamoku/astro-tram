import {
  date,
  duration,
  scheduledDuration,
  scheduledCallTime,
} from "../providers/render";
import type { Journey, TripStop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import ScheduleTime from "./ScheduleTime";
type Props = { journey: Journey; locale: string; t: Dictionary };
export function JourneyTime({
  journey,
  index,
  event,
  locale,
  className,
  timelinePoint,
}: {
  journey: Journey;
  index: number;
  event: "departure" | "arrival";
  locale: string;
  className?: string;
  timelinePoint?: number;
}) {
  const leg = journey.legs[index];
  const value =
    event === "departure" ? leg.scheduledDeparture : leg.scheduledArrival;
  return (
    <ScheduleTime
      value={value}
      referenceTime={journey.legs[0]?.scheduledDeparture}
      locale={locale}
      className={className}
      timelinePoint={timelinePoint}
    />
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
export function TripCallTime({
  call,
  locale,
  event = "departure",
  referenceTime,
}: {
  call: TripStop;
  locale: string;
  event?: "arrival" | "departure";
  referenceTime?: string | null;
}) {
  const value = scheduledCallTime(call, event);
  return (
    <ScheduleTime value={value} referenceTime={referenceTime} locale={locale} />
  );
}
