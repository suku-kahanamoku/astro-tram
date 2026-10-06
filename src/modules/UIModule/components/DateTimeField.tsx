import DatePicker from "react-datepicker";
import { shift } from "@floating-ui/react";
import { format, isValid, parse } from "date-fns";
import { cs, de, enUS } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/dateTimeField.css";

const locales: Record<string, typeof cs> = { cs, de, en: enUS };

/** Replaceable UI adapter. Its callers only use ISO day / 24-hour time strings. */
export default function DateTimeField({
  id,
  label,
  kind,
  value,
  locale,
  onChange,
}: {
  id: string;
  label: string;
  kind: "date" | "time";
  value: string;
  locale: string;
  onChange: (value: string) => void;
}) {
  const wireFormat = kind === "date" ? "yyyy-MM-dd" : "HH:mm";
  const selected = parse(value, wireFormat, new Date(2000, 0, 1, 12));
  const formats = kind === "date" ? ["dd. MM. yyyy", "yyyy-MM-dd"] : ["HH:mm"];
  return (
    <label className="field-label ui-date-time" data-kind={kind} htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      <DatePicker
        id={id}
        ariaLabelledBy={`${id}-label`}
        selected={isValid(selected) ? selected : null}
        value={value && !isValid(selected) ? value : undefined}
        onChange={(date: Date | null) =>
          onChange(date ? format(date, wireFormat) : "")
        }
        onChangeRaw={(event) => {
          const raw = (event?.target as HTMLInputElement | undefined)?.value;
          if (typeof raw !== "string") return;
          const date = formats
            .map((f) => parse(raw, f, new Date(2000, 0, 1, 12)))
            .find((d, i) => isValid(d) && format(d, formats[i]) === raw);
          onChange(date ? format(date, wireFormat) : raw);
        }}
        locale={locales[locale] ?? enUS}
        dateFormat={formats}
        timeFormat="HH:mm"
        timeCaption={label}
        showTimeSelect={kind === "time"}
        showTimeSelectOnly={kind === "time"}
        timeIntervals={15}
        calendarStartDay={1}
        strictParsing
        required
        autoComplete="off"
        showIcon
        toggleCalendarOnIconClick
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            {kind === "date" ? (
              <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </>
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </>
            )}
          </svg>
        }
        popperClassName="ui-date-time-popover"
        popperPlacement="bottom-start"
        popperModifiers={[shift({ padding: 12 })]}
        calendarClassName="ui-date-time-calendar"
        showPopperArrow={false}
        onFocus={(event) => (event.target as HTMLInputElement).select()}
      />
    </label>
  );
}
