import { useHydrated } from "../../UIModule/hooks/useHydrated";
import { useEffect, useState } from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import Icon from "../../UIModule/components/TransitIcon";
import SearchOptions from "./SearchOptions";
import {
  editorFields,
  searchDraft,
  submissionInstant,
} from "../providers/searchDefaults";
import { dismissMobileKeyboard } from "../../UIModule/providers/mobileKeyboard";
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
  const ready = useHydrated();
  const coverage = useCountryCoverage();
  const country = coverage.countries.find((c) => c.state === draft.country);
  const searchAvailable =
    !coverage.loading &&
    !coverage.error &&
    (draft.country
      ? country?.searchAvailable === true
      : coverage.countries.some((c) => c.searchAvailable));
  const countries = coverage.countries
    .filter((c) => c.searchAvailable)
    .map((c) => c.state);
  const persistentSearch = writeState(readState(url.searchParams)).toString();
  useEffect(() => {
    const state = searchDraft(url.searchParams);
    setDraft(state);
    setFields(editorFields(state));
    setTyped({
      from: state.from?.label ?? state.fromText ?? "",
      to: state.to?.label ?? state.toText ?? "",
    });
    setError("");
  }, [persistentSearch]);
  const changeScope = (patch: Partial<SearchState>) => {
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
      fromText: undefined,
      toText: undefined,
    }));
  };
  const scope = `${draft.country}:${draft.city ?? ""}`;
  const countryId = draft.country.toLowerCase() || "world";
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!searchAvailable) return;
            setError("");
            try {
              const state = { ...draft, page: undefined };
              for (const side of ["from", "to"] as const) {
                state[`${side}Text`] = state[side]
                  ? undefined
                  : typed[side].trim();
                if (!state[side] && !state[`${side}Text`]) {
                  setError(t.choose);
                  document.getElementById(`place-${side}`)?.focus();
                  return;
                }
              }
              state.at = submissionInstant(state, fields);
              dismissMobileKeyboard();
              location.assign(`${searchUrl}?${writeState(state)}#results`);
            } catch {
              setError(t.invalid);
            }
          }}
        >
          <fieldset
            disabled={!ready || !searchAvailable}
            style={{ display: "contents" }}
          >
            <input type="hidden" id="travel-country" value={draft.country} />
            {draft.country && country?.citiesAvailable && (
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
                  countries={countries}
                  t={t}
                  onChange={(place, text) => {
                    setTyped((s) => ({
                      ...s,
                      [side]: text ?? place?.label ?? "",
                    }));
                    setDraft((s) => ({
                      ...s,
                      [side]: place,
                      [`${side}Text`]: undefined,
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
                      navigate(url.pathname + "?" + params + url.hash);
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
                  setDraft((s) => ({
                    ...s,
                    from: s.to,
                    to: s.from,
                    fromText: s.toText,
                    toText: s.fromText,
                  }));
                  setTyped((s) => ({ from: s.to, to: s.from }));
                }}
              >
                <Icon name="swap" size={20} />
              </button>
            </div>
            <SearchOptions
              t={t}
              locale={locale}
              draft={draft}
              fields={fields}
              setDraft={setDraft}
              setFields={setFields}
            />
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
