import { useHydrated } from "../../UIModule/hooks/useHydrated";
import { useEffect, useState } from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import Icon from "../../UIModule/components/TransitIcon";
import PlaceField from "./PlaceField";
import CityPicker from "./CityPicker";
import {
  readState,
  writeState,
  localFields,
  formInstant,
} from "../providers/state";
import type { Dictionary } from "../providers/translations";
import type { SearchState } from "../types";
export default function SearchForm({
  t,
  searchUrl,
}: {
  t: Dictionary;
  searchUrl: string;
}) {
  const { url, navigate } = useUrlNavigation();
  const [draft, setDraft] = useState<SearchState>(() =>
    readState(url.searchParams),
  );
  const [fields, setFields] = useState({ day: "", time: "" });
  const [error, setError] = useState("");
  const ready = useHydrated();
  useEffect(() => {
    const state = readState(url.searchParams);
    setDraft(state);
    setFields(localFields(state.at ? new Date(state.at) : new Date()));
    setError("");
  }, [url.search]);
  const read = () => ({ ...draft, at: formInstant(fields.day, fields.time) });
  const changeScope = (patch: Partial<SearchState>) =>
    setDraft((s) => ({ ...s, ...patch, from: undefined, to: undefined }));
  const scope = `${draft.country}:${draft.city ?? ""}`;
  return (
    <>
      <div className="country-tabs" role="tablist" aria-label={t.country}>
        <button
          type="button"
          role="tab"
          id="country-cz"
          aria-selected="true"
          aria-controls="country-search-cz"
          tabIndex={0}
        >
          <span aria-hidden="true">🇨🇿</span> {t.cz}
        </button>
      </div>
      <div role="tabpanel" id="country-search-cz" aria-labelledby="country-cz">
        <form
          className="journey-form"
          data-search-form
          action={searchUrl}
          method="get"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const state = read();
              if (!state.from || !state.to) {
                setError(t.choose);
                document
                  .getElementById(!state.from ? "place-from" : "place-to")
                  ?.focus();
                return;
              }
              location.assign(`${searchUrl}?${writeState(state)}`);
            } catch {
              setError(t.invalid);
            }
          }}
        >
          <fieldset disabled={!ready} style={{ display: "contents" }}>
            <input type="hidden" id="travel-country" value={draft.country} />
            <CityPicker
              value={draft.city ?? ""}
              country={draft.country}
              t={t}
              onChange={(city) => changeScope({ city })}
            />
            <div className="place-fields">
              {(["from", "to"] as const).map((side) => (
                <PlaceField
                  key={`${scope}:${side}`}
                  side={side}
                  value={draft[side]}
                  state={draft}
                  t={t}
                  onChange={(place) =>
                    setDraft((s) => ({ ...s, [side]: place }))
                  }
                  onError={setError}
                  onMap={() => {
                    try {
                      const params = writeState(read());
                      params.set("map", side);
                      navigate(url.pathname + "?" + params);
                    } catch {
                      setError(t.invalid);
                    }
                  }}
                />
              ))}
              <button
                type="button"
                className="swap-button"
                data-swap
                aria-label={t.swap}
                onClick={() =>
                  setDraft((s) => ({ ...s, from: s.to, to: s.from }))
                }
              >
                <Icon name="swap" size={20} />
              </button>
            </div>
            <div className="search-options">
              <label className="field-label" htmlFor="travel-day">
                {t.day}
                <input
                  id="travel-day"
                  type="date"
                  required
                  value={fields.day}
                  onChange={(e) =>
                    setFields((s) => ({ ...s, day: e.target.value }))
                  }
                />
              </label>
              <label className="field-label" htmlFor="travel-time">
                {t.time}
                <input
                  id="travel-time"
                  type="time"
                  required
                  value={fields.time}
                  onChange={(e) =>
                    setFields((s) => ({ ...s, time: e.target.value }))
                  }
                />
              </label>
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
              <button type="submit" className="button search-submit">
                {t.search}
                <Icon name="arrow" size={20} />
              </button>
            </div>
            <div className="form-bottom">
              <span>
                <Icon name="clock" size={14} />
                {t.timezone}
              </span>
            </div>
            <p
              className="form-error"
              data-form-error
              role="alert"
              hidden={!error}
            >
              {error}
            </p>
          </fieldset>
        </form>
      </div>
      <noscript>
        <p className="notice">{t.javascript}</p>
      </noscript>
    </>
  );
}
