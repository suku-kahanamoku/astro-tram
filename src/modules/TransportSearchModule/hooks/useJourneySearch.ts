import { useEffect, useMemo, useRef, useState } from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import {
  readState,
  writeState,
  requiresLocation,
  searchBody,
} from "../../TransportCoreModule/providers/state";
import { getFix } from "../../TransportCoreModule/providers/geolocation";
import { transportClient } from "../../TransportCoreModule/providers/client";
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
    if (!state.from || !state.to || !state.at) {
      setValue({ key, data: null, error: "search_prompt", loading: false });
      return;
    }
    setValue({ key, data: null, error: "", loading: true });
    void (async () => {
      try {
        const fix = requiresLocation(state) ? await getFix() : undefined;
        if (abort.signal.aborted) return;
        const data = await transportClient.search(
          searchBody(state, fix),
          abort.signal,
        );
        if (abort.signal.aborted) return;
        const next = new URL(
          `${url.pathname}?${writeState(state)}`,
          url.origin,
        );
        // Unknown area metadata must not erase the user's selection.
        if (data.journeys.length) {
          if (data.intercity) next.searchParams.delete("city");
          else if (!state.city && data.city)
            next.searchParams.set("city", data.city);
        }
        const resolvedKey = writeState(readState(next.searchParams)).toString();
        completed.current = resolvedKey;
        setValue({ key: resolvedKey, data, error: "", loading: false });
        if (resolvedKey !== key) navigate(next.href, true);
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
