import { useEffect, useMemo, useRef, useState } from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import {
  readState,
  writeState,
  requiresLocation,
} from "../../TransportCoreModule/providers/state";
import { getFix } from "../../TransportCoreModule/providers/geolocation";
import { transportClient } from "../../TransportCoreModule/providers/client";
import { journeySubmission } from "../providers/journeySubmission";
import { resolveTypedPlace } from "../providers/placeSuggestions";
import type { SearchResult } from "../../TransportCoreModule/types";
export function useJourneySearch(enabled: boolean) {
  const { url, navigate } = useUrlNavigation();
  const state = useMemo(() => readState(url.searchParams), [url.search]);
  const key = writeState(state).toString();
  const [value, setValue] = useState<{
    key: string;
    data: SearchResult | null;
    error: string;
    loading: boolean;
  }>({ key: "", data: null, error: "", loading: enabled });
  const completed = useRef("");
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!enabled || completed.current === key) return;
    const abort = new AbortController();
    if (
      (!state.from && !state.fromText) ||
      (!state.to && !state.toText) ||
      !state.at
    ) {
      setValue({ key, data: null, error: "search_prompt", loading: false });
      return;
    }
    setValue({ key, data: null, error: "", loading: true });
    void (async () => {
      try {
        if (state.fromText || state.toText) {
          const resolved = { ...state };
          const countries = state.country
            ? []
            : (await transportClient.coverage(abort.signal))
                .filter((country) => country.searchAvailable)
                .map((country) => country.state);
          await Promise.all(
            (["from", "to"] as const).map(async (side) => {
              if (resolved[side]) return;
              const choice = await resolveTypedPlace(
                resolved[`${side}Text`] ?? "",
                resolved,
                abort.signal,
                countries,
              );
              if (!choice) throw new Error("places_unresolved");
              resolved[side] = choice.place;
              resolved[`${side}Text`] = undefined;
            }),
          );
          abort.signal.throwIfAborted();
          // Publish resolved selections first; only the next URL-driven effect plans a trip.
          navigate(`${url.pathname}?${writeState(resolved)}${url.hash}`, true);
          return;
        }
        const fix = requiresLocation(state) ? await getFix() : undefined;
        if (abort.signal.aborted) return;
        const data = await transportClient.search(
          await journeySubmission(state, abort.signal, fix),
          abort.signal,
        );
        if (abort.signal.aborted) return;
        // Backend area metadata describes this journey, not the user's search scope.
        completed.current = key;
        setValue({ key, data, error: "", loading: false });
      } catch (e) {
        if (!abort.signal.aborted) {
          completed.current = key;
          setValue({
            key,
            data: null,
            error: e instanceof Error ? e.message : "unavailable",
            loading: false,
          });
        }
      }
    })();
    return () => abort.abort();
  }, [key, enabled, attempt, navigate]);
  return {
    ...value,
    state,
    retry: () => {
      completed.current = "";
      retry((n) => n + 1);
    },
  };
}
