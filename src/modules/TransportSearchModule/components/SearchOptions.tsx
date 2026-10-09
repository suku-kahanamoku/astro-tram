import type { Dispatch, SetStateAction } from "react";
import Icon from "../../UIModule/components/TransitIcon";
import DateTimeField from "../../UIModule/components/DateTimeField";
import type { SearchState } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
/** Date/time and journey preferences share the form's draft; no independent URL state. */
export default function SearchOptions({
  t,
  locale,
  draft,
  fields,
  setDraft,
  setFields,
}: {
  t: Dictionary;
  locale: string;
  draft: SearchState;
  fields: { day: string; time: string };
  setDraft: Dispatch<SetStateAction<SearchState>>;
  setFields: Dispatch<SetStateAction<{ day: string; time: string }>>;
}) {
  return (
    <div className="search-options">
      <DateTimeField
        id="travel-day"
        label={t.day}
        kind="date"
        value={fields.day}
        locale={locale}
        onChange={(day) => {
          setFields((s) => ({ ...s, day }));
          setDraft((s) => ({ ...s, dayMode: undefined }));
        }}
      />
      <DateTimeField
        id="travel-time"
        label={t.time}
        kind="time"
        value={fields.time}
        locale={locale}
        onChange={(time) => {
          setFields((s) => ({ ...s, time }));
          setDraft((s) => ({ ...s, timeMode: undefined }));
        }}
      />
      <div className="search-preferences">
        <fieldset className="time-mode">
          <legend className="sr-only">
            {t.depart} / {t.arrive}
          </legend>
          {(["depart", "arrive"] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="timing"
                value={mode}
                checked={draft.arrive === (mode === "arrive")}
                onChange={() =>
                  setDraft((s) => ({ ...s, arrive: mode === "arrive" }))
                }
              />
              <span>{t[mode]}</span>
            </label>
          ))}
        </fieldset>
        <label className="direct-toggle">
          <input
            type="checkbox"
            data-direct
            checked={draft.direct}
            onChange={(e) =>
              setDraft((s) => ({ ...s, direct: e.target.checked }))
            }
          />
          <span>{t.direct}</span>
        </label>
      </div>
      <button type="submit" className="button search-submit">
        {t.search}
        <Icon name="arrow" size={20} />
      </button>
    </div>
  );
}
