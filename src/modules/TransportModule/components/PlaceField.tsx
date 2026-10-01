import { useEffect, useRef, useState } from "react";
import Combobox from "../../UIModule/components/Combobox";
import Icon from "../../UIModule/components/TransitIcon";
import { useAsyncOptions } from "../../UIModule/hooks/useAsyncOptions";
import { getAutocompleteFix, getFix } from "../providers/geolocation";
import { transportClient } from "../providers/client";
import { transportClientConfig as config } from "../config/client";
import type { Dictionary } from "../providers/translations";
import type { Place, PlaceOption, SearchState, Fix } from "../types";
export default function PlaceField({
  side,
  value,
  state,
  t,
  onChange,
  onMap,
  onError,
}: {
  side: "from" | "to";
  value?: Place;
  state: SearchState;
  t: Dictionary;
  onChange: (place?: Place) => void;
  onMap: () => void;
  onError: (message: string) => void;
}) {
  const label =
    value?.type === "current_location" ? t.current : (value?.label ?? "");
  const [text, setText] = useState(label),
    [open, setOpen] = useState(false),
    [nearby, setNearby] = useState(false),
    [locating, setLocating] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const revision = useRef(0);
  useEffect(
    () => () => {
      revision.current++;
    },
    [],
  );
  const { options, loading, error, run, cancel } =
    useAsyncOptions<PlaceOption>();
  useEffect(() => {
    revision.current++;
    if (!editing.current) setText(label);
    editing.current = false;
  }, [label]);
  const hide = () => {
    cancel();
    setOpen(false);
  };
  const nearest = (fix?: Fix) => {
    setNearby(true);
    setOpen(true);
    run(async (signal) => {
      const p = fix ?? (await getFix());
      if (signal.aborted) return [];
      return transportClient.places(
        {
          latitude: p.lat,
          longitude: p.lon,
          observed_at: p.observedAt,
          state: state.country,
        },
        signal,
        true,
      );
    });
  };
  const select = (index: number) => {
    revision.current++;
    const p = options[index];
    if (!p) return;
    hide();
    setText(p.name);
    onChange({ type: "stop", id: p.id, label: p.name });
    input.current?.focus();
  };
  const locate = async () => {
    hide();
    setLocating(true);
    const version = ++revision.current;
    try {
      const fix = await getFix();
      if (version !== revision.current) return;
      setText(t.current);
      onChange({ type: "current_location", label: t.current });
      input.current?.focus();
      nearest(fix);
    } catch {
      if (version === revision.current) onError(t.locationError);
    } finally {
      setLocating(false);
    }
  };
  const searchPlaces = (query: string) => {
    if (query.trim().length < config.minimumQueryLength) return;
    setNearby(false);
    setOpen(true);
    run(async (signal) => {
      const fix = !state.city ? await getAutocompleteFix() : undefined;
      if (signal.aborted) return [];
      return transportClient.places(
        {
          name: { $regex: query.trim() },
          ...(state.country ? { state: state.country } : {}),
          ...(state.city ? { city: state.city } : {}),
          ...(fix
            ? {
                latitude: fix.lat,
                longitude: fix.lon,
                observed_at: fix.observedAt,
              }
            : {}),
        },
        signal,
        !!fix,
      );
    }, config.autocompleteDelayMs);
  };
  let hint = locating
    ? t.locating
    : loading
      ? nearby
        ? t.loadingNearby
        : t.loadingPlaces
      : error
        ? nearby
          ? t.nearbyChoicesError
          : ["backend_not_configured", "places_not_configured"].includes(error)
            ? t.placesNotConfigured
            : t.placesError
        : open
          ? nearby
            ? options.length
              ? t.chooseNearby
              : t.noNearbyChoices
            : options.length
              ? ""
              : t.noPlaces
          : "";
  return (
    <div className="place-field" data-place={side}>
      <label htmlFor={`place-${side}`}>
        <span className={`place-dot ${side === "to" ? "destination" : ""}`} />
        {t[side]}
      </label>
      <Combobox
        id={`place-${side}`}
        inputRef={input}
        type="text"
        placeholder={t.placeholder}
        maxLength={160}
        spellCheck={false}
        value={text}
        options={options.map((p) => ({
          key: p.id,
          label: p.name,
          detail: p.sourceMode === "fallback" ? t.fallback : undefined,
        }))}
        open={open}
        listId={`suggestions-${side}`}
        hint={hint}
        hintAttributes={{ "data-hint": side }}
        onChoose={select}
        onDismiss={hide}
        onBlur={hide}
        onFocus={(e) => {
          e.target.select();
          if (value?.type === "current_location") nearest();
          else searchPlaces(text);
        }}
        onText={(query) => {
          revision.current++;
          editing.current = true;
          setText(query);
          onChange(undefined);
          setNearby(false);
          hide();
          if (query.trim().length < config.minimumQueryLength) return;
          setOpen(true);
          searchPlaces(query);
        }}
        buttons={
          <>
            <button
              type="button"
              className="icon-button"
              data-location={side}
              disabled={locating}
              aria-label={`${t.location} – ${t[side]}`}
              title={t.location}
              onClick={() => void locate()}
            >
              <Icon name="locate" />
            </button>
            <button
              type="button"
              className="icon-button"
              data-map={side}
              aria-haspopup="dialog"
              disabled={!value}
              aria-label={`${t.map} – ${t[side]}`}
              title={t.map}
              onClick={onMap}
            >
              <Icon name="map" />
            </button>
          </>
        }
      />
    </div>
  );
}
