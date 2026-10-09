import { useEffect, useMemo, useRef, useState } from "react";
import Combobox from "../../UIModule/components/Combobox";
import Icon from "../../UIModule/components/TransitIcon";
import TransportBadge from "../../TransportCoreModule/components/TransportBadge";
import { placeDetail } from "../../TransportCoreModule/providers/transportPresentation";
import { selectPlace } from "../../TransportCoreModule/providers/placeSelection";
import { servedModes } from "../../TransportCoreModule/config/transportModes";
import { useAsyncOptions } from "../../UIModule/hooks/useAsyncOptions";
import { getFix } from "../../TransportCoreModule/providers/geolocation";
import { placeSuggestions } from "../providers/placeSuggestions";
import { scopedPlaces } from "../providers/placeScope";
import { transportClientConfig as config } from "../../TransportCoreModule/config/client";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
import type {
  Place,
  PlaceOption,
  SearchState,
  Fix,
} from "../../TransportCoreModule/types";
import { dismissMobileKeyboard } from "../../UIModule/providers/mobileKeyboard";
export default function PlaceField({
  side,
  value,
  state,
  countries,
  t,
  onChange,
  onMap,
  onError,
}: {
  side: "from" | "to";
  value?: Place;
  state: SearchState;
  countries: readonly string[];
  t: Dictionary;
  onChange: (place?: Place, text?: string, option?: PlaceOption) => void;
  onMap: () => void;
  onError: (message: string) => void;
}) {
  const label =
    value?.type === "current_location"
      ? t.current
      : (value?.label ?? state[`${side}Text`] ?? "");
  const [text, setText] = useState(label),
    [open, setOpen] = useState(false),
    [nearby, setNearby] = useState(false),
    [locating, setLocating] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const editing = useRef(false);
  const choicesOpen = useRef(false);
  const restoringFocus = useRef(false);
  const focusInput = () => {
    restoringFocus.current = true;
    input.current?.focus();
    restoringFocus.current = false;
  };
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
    choicesOpen.current = false;
    setOpen(false);
  };
  const nearest = (fix?: Fix) => {
    setNearby(true);
    choicesOpen.current = true;
    setOpen(true);
    run(async (signal) => {
      const p = fix ?? (await getFix());
      if (signal.aborted) return [];
      return scopedPlaces(null, state, countries, signal, p);
    });
  };
  const select = (index: number) => {
    if (showLocation) {
      void locate();
      return;
    }
    revision.current++;
    const p = options[index];
    if (!p) return;
    hide();
    setText(p.name);
    onChange(selectPlace(p), p.name, p);
    if (!dismissMobileKeyboard()) focusInput();
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
      if (!dismissMobileKeyboard()) focusInput();
      nearest(fix);
    } catch {
      if (version === revision.current) onError(t.locationError);
    } finally {
      setLocating(false);
    }
  };
  const searchPlaces = (query: string) => {
    if (query.trim().length < config.minimumQueryLength) {
      setNearby(false);
      choicesOpen.current = true;
      setOpen(true);
      return;
    }
    setNearby(false);
    choicesOpen.current = true;
    setOpen(true);
    run(
      (signal) => placeSuggestions(query, state, signal, countries),
      config.autocompleteDelayMs,
    );
  };
  const showLocation =
    !nearby && text.trim().length < config.minimumQueryLength;
  const comboOptions = useMemo(
    () =>
      showLocation
        ? [
            {
              key: "current-location",
              label: t.current,
              detail: t.location,
              icon: <TransportBadge mode="location" t={t} variant="icon" />,
            },
          ]
        : options.map((p) => {
            const modes = [
              ...new Set(
                (p.modes ?? []).filter((mode) => servedModes.has(mode)),
              ),
            ];
            return {
              key: p.id,
              label: p.name,
              detail: placeDetail(
                { ...p, modes, state: p.state ?? state.country },
                t,
              ),
              icon: (
                <span className="place-option-symbols">
                  {(modes.length ? modes.slice(0, 3) : [p.kind ?? "stop"]).map(
                    (mode) => (
                      <TransportBadge
                        key={mode}
                        mode={mode}
                        t={t}
                        variant="icon"
                      />
                    ),
                  )}
                  {modes.length > 3 && <small>+{modes.length - 3}</small>}
                </span>
              ),
            };
          }),
    [showLocation, options, state.country, t],
  );
  const openChoices = () => {
    if (choicesOpen.current || restoringFocus.current || locating) return;
    if (value?.type === "current_location") nearest();
    else searchPlaces(text);
  };
  const hint = locating
    ? t.locating
    : loading
      ? nearby
        ? t.loadingNearby
        : t.loadingPlaces
      : error && !showLocation
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
            : showLocation || options.length
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
        required
        placeholder={t.placeholder}
        maxLength={160}
        spellCheck={false}
        value={text}
        options={comboOptions}
        open={open}
        listId={`suggestions-${side}`}
        hint={hint}
        hintAttributes={{ "data-hint": side }}
        onChoose={select}
        onDismiss={hide}
        onBlur={hide}
        onFocus={(e) => {
          e.target.select();
          openChoices();
        }}
        onClick={() => {
          openChoices();
        }}
        onText={(query) => {
          revision.current++;
          editing.current = true;
          setText(query);
          onChange(undefined, query);
          setNearby(false);
          hide();
          choicesOpen.current = true;
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
