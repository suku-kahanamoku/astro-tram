import { useHydrated } from "../../UIModule/hooks/useHydrated";
import { useEffect, useRef, useState } from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import Icon from "../../UIModule/components/TransitIcon";
import DateTimeField from "../../UIModule/components/DateTimeField";
import {
  editorFields,
  searchDraft,
  submissionInstant,
} from "../providers/searchDefaults";
import { resolveTypedPlace } from "../providers/placeSuggestions";
import PlaceField from "./PlaceField";
import CityPicker from "./CityPicker";
import CountryTabs from "./CountryTabs";
import { useCountryCoverage } from "../hooks/useCountryCoverage";
import {
  readState,
  writeState,
} from "../../TransportCoreModule/providers/state";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import type { SearchState } from "../../TransportCoreModule/types";
export default function SearchForm({
  t,
  searchUrl,
  locale,
}: {
  t: Dictionary;
  searchUrl: string;
  locale: string;
}) {
  const { url, navigate } = useUrlNavigation();
  const [draft, setDraft] = useState<SearchState>(() =>
    searchDraft(url.searchParams),
  );
  const [fields, setFields] = useState({ day: "", time: "" });
  const [error, setError] = useState("");
  const [typed, setTyped] = useState({ from: "", to: "" });
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const missingSide = useRef<"from" | "to" | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!submitting && missingSide.current) {
      document.getElementById(`place-${missingSide.current}`)?.focus();
      missingSide.current = null;
    }
  }, [submitting]);
  const ready = useHydrated();
  const coverage = useCountryCoverage();
  const country = coverage.countries.find((c) => c.state === draft.country);
  const searchAvailable =
    !coverage.loading && !coverage.error && country?.searchAvailable === true;
  const persistentSearch = writeState(readState(url.searchParams)).toString();
  useEffect(() => {
    pending.current?.abort();
    const state = searchDraft(url.searchParams);
    setDraft(state);
    setFields(editorFields(state));
    setTyped({ from: state.from?.label ?? "", to: state.to?.label ?? "" });
    setSubmitting(false);
    setError("");
  }, [persistentSearch]);
  const changeScope = (patch: Partial<SearchState>) => {
    pending.current?.abort();
    setTyped({ from: "", to: "" });
    setDraft((s) => ({
      ...s,
      ...patch,
      areaMode: undefined,
      ...(patch.country !== undefined && patch.country !== s.country
        ? { city: undefined }
        : {}),
      from: { type: "current_location", label: "" },
      to: undefined,
    }));
  };
  const scope = `${draft.country}:${draft.city ?? ""}`;
  const countryId = draft.country.toLowerCase();
  return (
    <>
      <CountryTabs
        value={draft.country}
        countries={coverage.countries}
        loading={coverage.loading || coverage.error}
        t={t}
        onChange={(country) => changeScope({ country })}
      />
      {coverage.error ? (
        <p className="notice">
          {t.coverageError}{" "}
          <button type="button" onClick={coverage.retry}>
            {t.retry}
          </button>
        </p>
      ) : !coverage.loading && !searchAvailable ? (
        <p className="notice">{t.countryUnavailable}</p>
      ) : null}
      <div
        role="tabpanel"
        id={`country-search-${countryId}`}
        aria-labelledby={`country-${countryId}`}
      >
        <form
          className="journey-form"
          data-search-form
          action={searchUrl}
          method="get"
          autoComplete="off"
          aria-busy={submitting}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!searchAvailable || submitting) return;
            pending.current?.abort();
            const controller = new AbortController();
            pending.current = controller;
            setSubmitting(true);
            setError("");
            try {
              const state = { ...draft, page: undefined };
              // Resolve both fields through the same ranked catalogue used by the dropdown.
              for (const side of ["from", "to"] as const) {
                if (state[side]) continue;
                const resolved = await resolveTypedPlace(
                  typed[side],
                  state,
                  controller.signal,
                );
                controller.signal.throwIfAborted();
                if (resolved) {
                  state[side] = resolved.place;
                  if (state.areaMode === "gps" && resolved.option.state) {
                    state.country = resolved.option.state;
                  }
                }
              }
              if (!state.from || !state.to) {
                setError(t.choose);
                missingSide.current = !state.from ? "from" : "to";
                return;
              }
              // Timestamp comes after resolving text, immediately before navigation/submission.
              state.at = submissionInstant(state, fields);
              location.assign(`${searchUrl}?${writeState(state)}`);
            } catch (failure) {
              if (!controller.signal.aborted)
                setError(
                  failure instanceof Error && failure.message === "invalid"
                    ? t.invalid
                    : t.placesError,
                );
            } finally {
              if (pending.current === controller) setSubmitting(false);
            }
          }}
        >
          <fieldset
            disabled={!ready || !searchAvailable || submitting}
            style={{ display: "contents" }}
          >
            <input type="hidden" id="travel-country" value={draft.country} />
            {country?.citiesAvailable && (
              <CityPicker
                value={draft.city ?? ""}
                country={draft.country}
                t={t}
                onChange={(city) => changeScope({ city })}
              />
            )}
            <div className="place-fields">
              {(["from", "to"] as const).map((side) => (
                <PlaceField
                  key={`${scope}:${side}`}
                  side={side}
                  value={draft[side]}
                  state={draft}
                  t={t}
                  onChange={(place, text, option) => {
                    pending.current?.abort();
                    setTyped((s) => ({
                      ...s,
                      [side]: text ?? place?.label ?? "",
                    }));
                    setDraft((s) => ({
                      ...s,
                      [side]: place,
                      ...(s.areaMode === "gps" && option?.state
                        ? {
                            country: option.state,
                          }
                        : {}),
                    }));
                  }}
                  onError={setError}
                  onMap={() => {
                    try {
                      // Opening a map must not rerun an automatic-clock search.
                      const params = writeState({
                        ...draft,
                        page: undefined,
                        at: draft.at ?? submissionInstant(draft, fields),
                      });
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
                onClick={() => {
                  setDraft((s) => ({ ...s, from: s.to, to: s.from }));
                  setTyped((s) => ({ from: s.to, to: s.from }));
                }}
              >
                <Icon name="swap" size={20} />
              </button>
            </div>
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
            {error && (
              <p className="form-error" data-form-error role="alert">
                {error}
              </p>
            )}
          </fieldset>
        </form>
      </div>
      <noscript>
        <p className="notice">{t.javascript}</p>
      </noscript>
    </>
  );
}
