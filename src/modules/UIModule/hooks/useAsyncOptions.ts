import { useCallback, useEffect, useRef, useState } from "react";
/** Debounced requests with cancellation and stale-response protection, reusable by pickers. */
export function useAsyncOptions<T>() {
  const active = useRef<{
    abort?: AbortController;
    timer?: ReturnType<typeof setTimeout>;
    version: number;
  }>({ version: 0 });
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cancel = useCallback(() => {
    active.current.version++;
    active.current.abort?.abort();
    clearTimeout(active.current.timer);
    setLoading(false);
  }, []);
  useEffect(
    () => () => {
      active.current.abort?.abort();
      clearTimeout(active.current.timer);
      active.current.version++;
    },
    [],
  );
  const run = useCallback(
    (load: (signal: AbortSignal) => Promise<T[]>, delay = 0) => {
      cancel();
      const version = active.current.version;
      const abort = new AbortController();
      active.current.abort = abort;
      setError("");
      setOptions([]);
      setLoading(true);
      active.current.timer = setTimeout(() => {
        void load(abort.signal)
          .then((rows) => {
            if (version === active.current.version) setOptions(rows);
          })
          .catch((e) => {
            if (version === active.current.version)
              setError(e instanceof Error ? e.message : "unavailable");
          })
          .finally(() => {
            if (version === active.current.version) setLoading(false);
          });
      }, delay);
    },
    [cancel],
  );
  return { options, loading, error, run, cancel };
}
