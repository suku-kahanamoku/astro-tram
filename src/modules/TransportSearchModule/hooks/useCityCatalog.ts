import { useCallback, useEffect, useRef, useState } from "react";
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
    };
    request.current = current;
    setState({ country, options: emptyOptions, loading: true, error: false });
    void transportClient.cities(country, current.abort.signal).then(
      (options) => {
        if (request.current !== current || current.abort.signal.aborted) return;
        current.status = "ready";
        setState({ country, options, loading: false, error: false });
      },
      () => {
        if (request.current !== current || current.abort.signal.aborted) return;
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
  };
}
