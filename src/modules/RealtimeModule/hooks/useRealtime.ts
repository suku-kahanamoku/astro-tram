import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRealtimeClient,
  type RealtimeOptions,
  type ConnectionState,
} from "../providers/client";
/** Connection lifecycle belongs to React; callbacks can change without reconnecting. */
export function useRealtime(options: RealtimeOptions & { enabled?: boolean }) {
  const callbacks = useRef(options);
  callbacks.current = options;
  const client = useRef<ReturnType<typeof createRealtimeClient> | null>(null);
  const [state, setState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const protocols = JSON.stringify(options.protocols ?? []);
  useEffect(() => {
    if (options.enabled === false || !options.url) {
      setState("idle");
      return;
    }
    let mounted = true;
    const instance = createRealtimeClient({
      url: options.url,
      protocols: JSON.parse(protocols),
      maxRetries: options.maxRetries,
      onMessage: (data) => callbacks.current.onMessage(data),
      onState: (next) => {
        if (mounted) {
          setState(next);
          callbacks.current.onState?.(next);
        }
      },
    });
    client.current = instance;
    setError(null);
    try {
      instance.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unavailable");
      instance.close();
    }
    const close = () => instance.close();
    const restore = (e: PageTransitionEvent) => {
      if (e.persisted) instance.connect();
    };
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", restore);
    return () => {
      mounted = false;
      instance.close();
      client.current = null;
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", restore);
    };
  }, [options.url, options.enabled, options.maxRetries, protocols]);
  const send = useCallback(
    (data: unknown) => client.current?.send(data) ?? false,
    [],
  );
  return { send, state, error };
}
