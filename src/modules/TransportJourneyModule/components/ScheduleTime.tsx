import { time, isFollowingDay } from "../providers/render";

/** One renderer for timetable clocks in summaries, legs and full-trip stop lists. */
export default function ScheduleTime({
  value,
  referenceTime,
  locale,
  className,
  timelinePoint,
}: {
  value?: string | null;
  referenceTime?: string | null;
  locale: string;
  className?: string;
  timelinePoint?: number;
}) {
  const valid = !!value && Number.isFinite(Date.parse(value));
  const nextDay = valid && isFollowingDay(value, referenceTime);
  return (
    <time
      className={["schedule-time", className].filter(Boolean).join(" ")}
      dateTime={valid ? value : undefined}
      data-trip-point={timelinePoint}
      data-next-day={nextDay ? true : undefined}
      title={
        nextDay
          ? new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(
              new Date(value),
            )
          : undefined
      }
    >
      {valid ? time(value, locale) : "—"}
    </time>
  );
}
