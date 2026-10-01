import { createRealtimeClient } from "../../RealtimeModule/providers/client";
import {
  transportClient,
  TransportRequestError,
} from "../../TransportCoreModule/providers/client";
import { observation, unavailableObservation } from "./tracking";
import { createTrackingStore } from "./trackingStore";
import type { TrackingSession } from "../../TransportCoreModule/types";

type Socket = ReturnType<typeof createRealtimeClient>;
type Watch = {
  controller: AbortController;
  socket?: Socket;
  expiry?: ReturnType<typeof setTimeout>;
  renewal?: ReturnType<typeof setTimeout>;
  ping?: ReturnType<typeof setInterval>;
};
/** Incremental subscriptions and a shared ticket queue, scoped to one mounted search. */
export function createTrackingSubscriptions(
  store: ReturnType<typeof createTrackingStore>,
  dependencies = {
    tracking: transportClient.tracking,
    socket: createRealtimeClient,
  },
) {
  const watches = new Map<string, Watch>();
  const tickets = new Map<string, TrackingSession>();
  const queue = new Map<string, Watch>();
  let pending = false,
    disposed = false,
    nextRequestAt = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;
  const active = (id: string, watch: Watch) =>
    !disposed && watches.get(id) === watch;
  const disconnect = (watch: Watch) => {
    clearTimeout(watch.expiry);
    clearTimeout(watch.renewal);
    clearInterval(watch.ping);
    watch.socket?.close();
    watch.socket = undefined;
  };
  const connect = (id: string, watch: Watch, session: TrackingSession) => {
    if (!active(id, watch)) return;
    if (
      session.status !== "available" ||
      !session.url ||
      !session.ticket ||
      !session.expiresAt
    ) {
      store.set(id, unavailableObservation(session.status));
      return;
    }
    disconnect(watch);
    const socket = dependencies.socket({
      url: session.url,
      onState(status) {
        if (!active(id, watch)) return;
        if (status === "open")
          watch.socket?.send({ type: "subscribe", ticket: session.ticket });
        else if (status !== "connecting")
          store.set(id, unavailableObservation());
      },
      onMessage(message) {
        if (!active(id, watch) || !message || typeof message !== "object")
          return;
        const m = message as { type?: string; trip?: string; data?: unknown };
        if (m.type !== "observation" || m.trip !== id) return;
        const value = observation(m.data);
        store.set(id, value);
        clearTimeout(watch.expiry);
        if (value.validUntil)
          watch.expiry = setTimeout(
            () => {
              if (active(id, watch))
                store.set(id, unavailableObservation("stale"));
            },
            Math.max(0, Date.parse(value.validUntil) - Date.now()),
          );
      },
    });
    watch.socket = socket;
    socket.connect();
    watch.ping = setInterval(() => socket.send({ type: "ping" }), 20000);
    watch.renewal = setTimeout(
      () => {
        if (!active(id, watch)) return;
        tickets.delete(id);
        queue.set(id, watch);
        pump();
      },
      Math.max(1000, Date.parse(session.expiresAt) - Date.now() - 30000),
    );
  };
  const pump = () => {
    if (disposed || pending) return;
    clearTimeout(wake);
    if (!queue.size) return;
    const remaining = nextRequestAt - Date.now();
    if (remaining > 0) {
      wake = setTimeout(pump, remaining);
      return;
    }
    const [id, watch] = queue.entries().next().value!;
    queue.delete(id);
    if (!active(id, watch)) {
      pump();
      return;
    }
    pending = true;
    // Pace ticket issuance; opening several cards must not produce a request burst.
    nextRequestAt = Date.now() + 1000;
    void dependencies
      .tracking(id, watch.controller.signal)
      .then((session) => {
        if (!active(id, watch)) return;
        if (tickets.size >= 100) tickets.delete(tickets.keys().next().value!);
        tickets.set(id, session);
        connect(id, watch, session);
      })
      .catch((error: unknown) => {
        if (!active(id, watch)) return;
        store.set(id, unavailableObservation());
        if (error instanceof TransportRequestError && error.status === 429) {
          // One cooldown for all pending tickets, not independent retries per vehicle.
          nextRequestAt = Math.max(
            nextRequestAt,
            Date.now() + (error.retryAfterMs ?? 60000),
          );
          queue.set(id, watch);
        } else {
          watch.renewal = setTimeout(() => {
            if (active(id, watch)) {
              queue.set(id, watch);
              pump();
            }
          }, 30000);
        }
      })
      .finally(() => {
        pending = false;
        pump();
      });
  };
  return {
    setIds(ids: readonly string[]) {
      if (disposed) return;
      const desired = new Set(ids);
      for (const [id, watch] of watches)
        if (!desired.has(id)) {
          watches.delete(id);
          queue.delete(id);
          watch.controller.abort();
          disconnect(watch);
          store.remove(id);
        }
      for (const id of desired) {
        if (watches.has(id)) continue;
        const watch: Watch = { controller: new AbortController() };
        watches.set(id, watch);
        const session = tickets.get(id);
        if (
          session &&
          (session.status !== "available" ||
            (session.expiresAt &&
              Date.parse(session.expiresAt) > Date.now() + 30000))
        )
          connect(id, watch, session);
        else {
          queue.set(id, watch);
        }
      }
      pump();
    },
    dispose() {
      disposed = true;
      clearTimeout(wake);
      for (const watch of watches.values()) {
        watch.controller.abort();
        disconnect(watch);
      }
      watches.clear();
      queue.clear();
      tickets.clear();
      store.clear();
    },
  };
}
