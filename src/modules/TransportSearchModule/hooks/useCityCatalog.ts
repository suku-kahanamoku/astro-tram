import { useCallback, useEffect, useRef, useState } from "react";
import { getFix } from "../../TransportCoreModule/providers/geolocation";
import { transportClient } from "../../TransportCoreModule/providers/client";
import type { CityOption } from "../../TransportCoreModule/types";

const emptyOptions: CityOption[] = [];
type CatalogState = {
  country: string;
  options: CityOption[];
  loading: boolean;
  error: boolean;
};
type CatalogRequest = {
  country: string;
  abort: AbortController;
  status: "loading" | "ready" | "error";
  rankingStarted: boolean;
  ranked: boolean;
};

/** Preload static metadata once per country/form, sharing in-flight requests with focus. */
export function useCityCatalog(country: string) {
  const request = useRef<CatalogRequest | null>(null);
  const [state, setState] = useState<CatalogState>({
    country,
    options: emptyOptions,
    loading: true,
    error: false,
  });
  const ensureLoaded = useCallback(() => {
    const previous = request.current;
    if (
      previous?.country === country &&
      !previous.abort.signal.aborted &&
      previous.status !== "error"
    )
      return;
    previous?.abort.abort();
    const current: CatalogRequest = {
      country,
      abort: new AbortController(),
      status: "loading",
      rankingStarted: false,
      ranked: false,
    };
    request.current = current;
    setState({ country, options: emptyOptions, loading: true, error: false });
    void transportClient.cities(country, current.abort.signal).then(
      (options) => {
        if (
          request.current !== current ||
          current.abort.signal.aborted ||
          current.ranked
        )
          return;
        current.status = "ready";
        setState({
          country,
          options: options.filter((city) => city.state === country),
          loading: false,
          error: false,
        });
      },
      () => {
        if (
          request.current !== current ||
          current.abort.signal.aborted ||
          current.ranked
        )
          return;
        current.status = "error";
        setState({
          country,
          options: emptyOptions,
          loading: false,
          error: true,
        });
      },
    );
  }, [country]);
  const ensureRanked = useCallback(() => {
    ensureLoaded();
    const current = request.current;
    if (!current || current.country !== country || current.rankingStarted)
      return;
    current.rankingStarted = true;
    // Request optional GPS only when the city picker is used, once per catalogue.
    void getFix()
      .catch(() => undefined)
      .then(async (fix) => {
        if (!fix || request.current !== current || current.abort.signal.aborted)
          return;
        try {
          const options = await transportClient.cities(
            country,
            current.abort.signal,
            fix,
          );
          if (request.current !== current || current.abort.signal.aborted)
            return;
          current.ranked = true;
          current.status = "ready";
          setState({
            country,
            options: options.filter((city) => city.state === country),
            loading: false,
            error: false,
          });
        } catch {
          /* Keep the working static catalogue when optional GPS ranking fails. */
        }
      });
  }, [country, ensureLoaded]);
  useEffect(() => {
    ensureLoaded();
    return () => request.current?.abort.abort();
  }, [ensureLoaded]);
  // Never expose the previous country's catalogue while its replacement is loading.
  return {
    options: state.country === country ? state.options : emptyOptions,
    loading: state.country !== country || state.loading,
    error: state.country === country && state.error,
    ensureLoaded,
    ensureRanked,
  };
}
