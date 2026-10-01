import { useEffect, useState } from "react";
import { createRealtimeClient } from "../../RealtimeModule/providers/client";
import { transportClient } from "../providers/client";
import { observation, unavailableObservation } from "../providers/tracking";
import type { TripObservation } from "../types";
/** A mounted detail owns subscriptions. Closing/changing it releases all sockets and timers. */
export function useTripTracking(ids: string[]) {
  const key = JSON.stringify([...new Set(ids)].sort());
  const [state, setState] = useState<{
    key: string;
    values: Record<string, TripObservation>;
  }>({ key, values: {} });
  useEffect(() => {
    let controller = new AbortController();
    let generation = 0;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    setState({ key, values: {} });
    const set = (id: string, value: TripObservation) => {
      if (!disposed)
        setState((s) => ({
          key,
          values: { ...(s.key === key ? s.values : {}), [id]: value },
        }));
    };
    const start = async (id: string) => {
      const cycle = generation;
      const signal = controller.signal;
      const active = () => !disposed && generation === cycle && !signal.aborted;
      let socket: ReturnType<typeof createRealtimeClient> | undefined;
      let expiry: ReturnType<typeof setTimeout> | undefined,
        renewal: ReturnType<typeof setTimeout> | undefined,
        ping: ReturnType<typeof setInterval> | undefined;
      cleanups.push(() => {
        clearTimeout(expiry);
        clearTimeout(renewal);
        clearInterval(ping);
        socket?.close();
      });
      const connect = async () => {
        clearTimeout(expiry);
        clearInterval(ping);
        socket?.close();
        if (!active()) return;
        set(id, unavailableObservation("connecting"));
        try {
          const session = await transportClient.tracking(id, signal);
          if (!active()) return;
          if (
            session.status !== "available" ||
            !session.url ||
            !session.ticket ||
            !session.expiresAt
          ) {
            set(id, unavailableObservation(session.status));
            return;
          }
          socket = createRealtimeClient({
            url: session.url,
            onState: (status) => {
              if (!active()) return;
              if (status === "open")
                socket?.send({ type: "subscribe", ticket: session.ticket });
              else if (status !== "connecting")
                set(id, unavailableObservation());
            },
            onMessage: (message) => {
              if (!active()) return;
              if (!message || typeof message !== "object") return;
              const m = message as {
                type?: string;
                trip?: string;
                data?: unknown;
              };
              if (m.type !== "observation" || m.trip !== id) return;
              const value = observation(m.data);
              set(id, value);
              clearTimeout(expiry);
              if (value.validUntil)
                expiry = setTimeout(
                  () => set(id, unavailableObservation("stale")),
                  Math.max(0, Date.parse(value.validUntil) - Date.now()),
                );
            },
          });
          socket.connect();
          ping = setInterval(() => socket?.send({ type: "ping" }), 20000);
          renewal = setTimeout(
            () => {
              void connect();
            },
            Math.max(1000, Date.parse(session.expiresAt) - Date.now() - 30000),
          );
        } catch {
          if (active()) set(id, unavailableObservation());
        }
      };
      await connect();
    };
    if (!document.hidden)
      for (const id of JSON.parse(key) as string[]) void start(id);
    const hide = () => {
      generation++;
      controller.abort();
      cleanups.splice(0).forEach((f) => f());
      controller = new AbortController();
      setState({ key, values: {} });
      if (!document.hidden)
        for (const id of JSON.parse(key) as string[]) void start(id);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      disposed = true;
      controller.abort();
      document.removeEventListener("visibilitychange", hide);
      cleanups.forEach((f) => f());
    };
  }, [key]);
  return state.key === key ? state.values : {};
}
