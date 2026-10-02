import { useEffect, useState } from "react";
import { transportClient } from "../../TransportCoreModule/providers/client";
import type { CountryCoverage } from "../../TransportCoreModule/types";

/** Load tenant capabilities once per form, independently of query text and GPS. */
export function useCountryCoverage() {
  const [countries, setCountries] = useState<CountryCoverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void transportClient.coverage(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setCountries(data);
        setLoading(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      },
    );
    return () => controller.abort();
  }, [attempt]);
  return { countries, loading, error, retry: () => setAttempt((n) => n + 1) };
}
