import { useEffect, useMemo, useRef, useState } from "react";
import Combobox from "../../UIModule/components/Combobox";
import { useCityCatalog } from "../hooks/useCityCatalog";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
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
  const [query, setQuery] = useState("");
  const [text, setText] = useState(value || t.allTimetables),
    [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { options, loading, error, ensureLoaded } = useCityCatalog(country);
  useEffect(() => {
    setText(value || t.allTimetables);
    setOpen(false);
  }, [value, country, t.allTimetables]);
  const load = () => {
    setQuery("");
    setOpen(true);
    ensureLoaded();
  };
  const index = useMemo(() => {
    const collator = new Intl.Collator("cs");
    return options
      .map((city) => ({ city, searchName: normalize(city.name) }))
      .sort((a, b) => collator.compare(a.city.name, b.city.name));
  }, [options]);
  const choices = useMemo(() => {
    const term = normalize(query);
    return index
      .filter((item) => item.searchName.includes(term))
      .map((item) => item.city);
  }, [index, query]);
  const comboOptions = useMemo(
    () => [
      { key: "", label: t.allTimetables },
      ...choices.map((city) => ({
        key: city.id,
        label: city.name,
        detail: city.sourceMode === "fallback" ? t.fallback : undefined,
      })),
    ],
    [choices, t.allTimetables, t.fallback],
  );
  const hide = () => {
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
        options={comboOptions}
        hint={
          loading
            ? t.loadingPlaces
            : error
              ? t.citiesError
              : open && !choices.length
                ? t.noCities
                : ""
        }
        hintAttributes={{ "data-city-hint": "" }}
        onText={(q) => {
          setText(q);
          setQuery(q.trim());
          setOpen(true);
        }}
        onChoose={(i) => {
          hide();
          const next = i === 0 ? "" : choices[i - 1]?.name;
          if (next === undefined) return;
          setText(next || t.allTimetables);
          onChange(next);
        }}
        onDismiss={hide}
        onBlur={hide}
        onFocus={(e) => {
          e.target.select();
          load();
        }}
        onClick={(e) => {
          if (!open) {
            e.currentTarget.select();
            load();
          }
        }}
        buttons={
          <button
            type="button"
            className="icon-button"
            data-city-toggle
            aria-label={t.cityTimetables}
            onClick={() => {
              if (document.activeElement === input.current) load();
              else input.current?.focus();
            }}
          >
            ⌄
          </button>
        }
      />
    </div>
  );
}
