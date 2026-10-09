import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../CoreModule/providers/api";
import type { OnlinePlannerState } from "../types";

const endpoint = "/api/admin/online-planners/";
function state(payload: OnlinePlannerState): OnlinePlannerState {
  if (typeof payload?.enabled !== "boolean")
    throw new Error("Invalid planner state");
  return { enabled: payload.enabled };
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
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const next = state(
          await api<OnlinePlannerState>(endpoint, {
            signal: controller.signal,
          }),
        );
        if (active) setValue(next);
      } catch (error) {
        if (active && error instanceof ApiError)
          readError.current = error.status;
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
      mutation.current?.abort();
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
    const controller = new AbortController();
    mutation.current = controller;
    try {
      const next = state(
        await api<OnlinePlannerState>(endpoint, {
          method: "POST",
          body: { enabled: !value.enabled },
          signal: controller.signal,
        }),
      );
      if (mounted.current) setValue(next);
    } catch (error) {
      if (mounted.current)
        setError(error instanceof ApiError ? error.status : 503);
    } finally {
      mutation.current = null;
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { value, loaded, pending, error, toggle };
}
