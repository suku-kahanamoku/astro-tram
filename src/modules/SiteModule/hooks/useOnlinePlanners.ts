import { useEffect, useRef, useState } from "react";
import type { OnlinePlannerState } from "../types";

const endpoint = "/api/admin/online-planners/";
async function state(response: Response): Promise<OnlinePlannerState> {
  const payload = await response.json();
  if (!payload.success || typeof payload.data?.enabled !== "boolean")
    throw new Error("Invalid planner state");
  return { enabled: payload.data.enabled };
}

/** Read once on mount; mutations update the shared policy from their confirmed response. */
export function useOnlinePlanners() {
  const [value, setValue] = useState<OnlinePlannerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(0);
  const readError = useRef(503);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
        if (!response.ok) {
          if (active) readError.current = response.status;
          return;
        }
        const next = await state(response);
        if (active) setValue(next);
      } catch {
        // Leave the policy unknown; retry only after the component is mounted again.
      } finally {
        if (active) setLoaded(true);
      }
    };
    void load();
    return () => {
      active = false;
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const toggle = async () => {
    if (!loaded || submitting.current) return;
    if (!value) {
      setError(readError.current);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError(0);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !value.enabled }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        if (mounted.current) setError(response.status);
        return;
      }
      const next = await state(response);
      if (mounted.current) setValue(next);
    } catch {
      if (mounted.current) setError(503);
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { value, loaded, pending, error, toggle };
}
