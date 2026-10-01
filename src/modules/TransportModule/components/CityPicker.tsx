import { useEffect, useRef, useState } from "react";
import Combobox from "../../UIModule/components/Combobox";
import { useAsyncOptions } from "../../UIModule/hooks/useAsyncOptions";
import { transportClient } from "../providers/client";
import { transportClientConfig as config } from "../config/client";
import type { Dictionary } from "../providers/translations";
const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
export default function CityPicker({
  value,
  country,
  t,
  onChange,
}: {
  value: string;
  country: string;
  t: Dictionary;
  onChange: (city: string) => void;
}) {
  const [text, setText] = useState(value || t.allTimetables),
    [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { options, loading, error, run, cancel } = useAsyncOptions<string>();
  useEffect(() => {
    setText(value || t.allTimetables);
    setOpen(false);
    cancel();
  }, [value, t.allTimetables, cancel]);
  const load = (query: string, delay = 0) => {
    setOpen(true);
    run(async (signal) => {
      const terms =
        query.length >= config.minimumQueryLength
          ? [query]
          : config.defaultCities;
      const rows = await Promise.all(
        terms.map((term) =>
          transportClient.places(
            { name: { $regex: term }, state: country },
            signal,
          ),
        ),
      );
      return [
        ...new Set(
          rows
            .flat()
            .map((p) => p.city)
            .filter(
              (c): c is string =>
                !!c && (!query || normalize(c).includes(normalize(query))),
            ),
        ),
      ].sort((a, b) => a.localeCompare(b, "cs"));
    }, delay);
  };
  const hide = () => {
    cancel();
    setOpen(false);
    setText(value || t.allTimetables);
  };
  return (
    <div className="place-field city-picker">
      <label htmlFor="travel-city">{t.cityTimetables}</label>
      <Combobox
        id="travel-city"
        inputRef={input}
        value={text}
        maxLength={120}
        spellCheck={false}
        autoComplete="off"
        open={open}
        listId="city-options"
        options={["", ...options].map((c) => ({
          key: c,
          label: c || t.allTimetables,
        }))}
        hint={
          loading
            ? t.loadingPlaces
            : error
              ? t.citiesError
              : open && !options.length
                ? t.noCities
                : ""
        }
        hintAttributes={{ "data-city-hint": "" }}
        onText={(q) => {
          setText(q);
          load(q.trim(), config.autocompleteDelayMs);
        }}
        onChoose={(i) => {
          hide();
          const next = ["", ...options][i];
          setText(next || t.allTimetables);
          onChange(next);
        }}
        onDismiss={hide}
        onBlur={hide}
        onFocus={(e) => {
          e.target.select();
          load("");
        }}
        buttons={
          <button
            type="button"
            className="icon-button"
            data-city-toggle
            aria-label={t.cityTimetables}
            onClick={() => {
              input.current?.focus();
              load("");
            }}
          >
            ⌄
          </button>
        }
      />
    </div>
  );
}
