import { useEffect, useRef, useState } from "react";
import type { OnlinePlannerState } from "../types";

const endpoint = "/api/admin/online-planners/";
async function state(response: Response): Promise<OnlinePlannerState> {
  const payload = await response.json();
  if (!payload.success || typeof payload.data?.enabled !== "boolean")
    throw new Error("Invalid planner state");
  return { enabled: payload.data.enabled };
}

/** Server-confirmed shared policy, with stale poll responses excluded during mutations. */
export function useOnlinePlanners() {
  const [value, setValue] = useState<OnlinePlannerState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(0);
  const version = useRef(0);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const revision = version.current;
      let retry = true;
      try {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        retry = ![401, 403].includes(response.status);
        if (!response.ok) return;
        const next = await state(response);
        if (
          !controller.signal.aborted &&
          revision === version.current &&
          !submitting.current
        )
          setValue(next);
      } catch {
        /* A failed refresh never invents or resets the confirmed state. */
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
          if (retry) timer = setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => {
      mounted.current = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const toggle = async () => {
    if (submitting.current) return;
    submitting.current = true;
    version.current++;
    setPending(true);
    setError(0);
    try {
      // Anonymous visitors have no setting value; authenticate before choosing any mutation.
      let current = value;
      if (!current) {
        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          if (mounted.current) setError(response.status);
          return;
        }
        current = await state(response);
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !current.enabled }),
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
      version.current++;
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { value, loaded, pending, error, toggle };
}
