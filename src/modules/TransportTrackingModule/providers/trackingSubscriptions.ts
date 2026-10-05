import { createRealtimeClient } from "../../RealtimeModule/providers/client";
import {
  transportClient,
  TransportRequestError,
} from "../../TransportCoreModule/providers/client";
import { observation, unavailableObservation } from "./tracking";
import { createTrackingStore } from "./trackingStore";
import type {
  TrackingSession,
  TripObservation,
} from "../../TransportCoreModule/types";

type Socket = ReturnType<typeof createRealtimeClient>;
type Watch = {
  controller: AbortController;
  session?: TrackingSession;
  subscribed?: boolean;
  expiry?: ReturnType<typeof setTimeout>;
  renewal?: ReturnType<typeof setTimeout>;
  snapshot?: AbortController;
  revision?: number;
  serverTrip?: string;
};
/** Incremental subscriptions and a shared ticket queue, scoped to one mounted search. */
export function createTrackingSubscriptions(
  store: ReturnType<typeof createTrackingStore>,
  dependencies: {
    tracking: typeof transportClient.tracking;
    socket: typeof createRealtimeClient;
    observation?: typeof transportClient.observation;
  } = {
    tracking: transportClient.tracking,
    socket: createRealtimeClient,
    observation: transportClient.observation,
  },
) {
  const watches = new Map<string, Watch>();
  const tickets = new Map<string, TrackingSession>();
  const queue = new Map<string, Watch>();
  let pending = false,
    disposed = false,
    nextRequestAt = 0;
  let wake: ReturnType<typeof setTimeout> | undefined;
  let socket: Socket | undefined;
  let socketUrl: string | undefined;
  let ready = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  const active = (id: string, watch: Watch) =>
    !disposed && watches.get(id) === watch;
  const currentObservation = (id: string) => {
    const value = store.getSnapshot()[id];
    return value?.validUntil && Date.parse(value.validUntil) > Date.now()
      ? value
      : undefined;
  };
  const apply = (id: string, watch: Watch, value: TripObservation) => {
    const current = currentObservation(id);
    // Temporary missing frames and older HTTP/WS samples cannot erase a fresh
    // delay or GPS sample. Its original source expiry stays unchanged.
    if (
      current &&
      (!value.validUntil ||
        (current.observedAt &&
          value.observedAt &&
          !(current.estimatedProgress && value.position) &&
          Date.parse(value.observedAt) < Date.parse(current.observedAt)))
    )
      return;
    if (current?.position && value.estimatedProgress && !value.position) return;
    // An unavailable frame is not a newer measurement and must not cancel the
    // dialog's pending initial HTTP read of delay and position.
    if (value.validUntil) watch.revision = (watch.revision ?? 0) + 1;
    store.set(id, value);
    clearTimeout(watch.expiry);
    if (value.validUntil)
      watch.expiry = setTimeout(
        () => {
          if (active(id, watch)) {
            store.set(id, unavailableObservation("stale"));
          }
        },
        Math.max(0, Date.parse(value.validUntil) - Date.now()),
      );
  };
  const disconnect = () => {
    clearInterval(ping);
    ready = false;
    const previous = socket;
    socket = undefined;
    socketUrl = undefined;
    previous?.close();
  };
  const subscribe = (id: string, watch: Watch) => {
    const session = watch.session;
    if (!ready || !session || !socket) return;
    if (!socket.send({ type: "subscribe", ticket: session.ticket })) return;
    // Each ticket is redeemed once; renew this subscription over the same connection.
    watch.session = undefined;
    watch.subscribed = true;
    clearTimeout(watch.renewal);
    watch.renewal = setTimeout(
      () => {
        if (active(id, watch)) {
          queue.set(id, watch);
          pump();
        }
      },
      Math.max(1000, Date.parse(session.expiresAt!) - Date.now() - 30000),
    );
  };
  const connect = (id: string, watch: Watch, session: TrackingSession) => {
    if (!active(id, watch)) return;
    if (
      session.status !== "available" ||
      !session.url ||
      !session.ticket ||
      !session.expiresAt
    ) {
      clearTimeout(watch.renewal);
      if (
        watch.subscribed &&
        ready &&
        ![...watches].some(
          ([other, item]) =>
            item !== watch &&
            item.subscribed &&
            (item.serverTrip ?? other) === (watch.serverTrip ?? id),
        )
      )
        socket?.send({ type: "unsubscribe", trip: watch.serverTrip ?? id });
      watch.session = undefined;
      watch.subscribed = false;
      if (!currentObservation(id) && !watch.snapshot)
        store.set(id, unavailableObservation(session.status));
      return;
    }
    if (socketUrl && socketUrl !== session.url) {
      // A search uses one configured gateway. Never silently create a second socket.
      if (!currentObservation(id))
        store.set(id, unavailableObservation("unsupported"));
      return;
    }
    queue.delete(id);
    watch.serverTrip = session.tripId ?? id;
    watch.session = session;
    if (socket) {
      subscribe(id, watch);
      return;
    }
    socketUrl = session.url;
    const connection = dependencies.socket({
      url: session.url,
      maxRetries: 0,
      onState(status) {
        if (disposed || socket !== connection) return;
        if (status === "open") {
          ready = true;
          for (const [trip, item] of watches) subscribe(trip, item);
          ping = setInterval(() => connection.send({ type: "ping" }), 20000);
        } else if (status !== "connecting") {
          disconnect();
          for (const [trip, item] of watches) {
            clearTimeout(item.renewal);
            item.session = undefined;
            item.subscribed = false;
            if (!currentObservation(trip))
              store.set(trip, unavailableObservation());
            if (!tickets.has(trip)) queue.set(trip, item);
          }
          if (retries < 8 && queue.size) {
            reconnect = setTimeout(
              () => {
                reconnect = undefined;
                pump();
              },
              Math.min(30000, 1000 * 2 ** retries++),
            );
          } else queue.clear();
        }
      },
      onMessage(message) {
        if (
          disposed ||
          socket !== connection ||
          !message ||
          typeof message !== "object"
        )
          return;
        const m = message as { type?: string; trip?: string; data?: unknown };
        if (!m.trip) return;
        for (const [id, item] of watches) {
          if ((item.serverTrip ?? id) !== m.trip) continue;
          if (m.type === "subscription_expired") {
            item.subscribed = false;
            clearTimeout(item.renewal);
            queue.set(id, item);
            pump();
          } else if (m.type === "observation") {
            retries = 0;
            let value = observation(m.data);
            // Measured GPS and delay are portable. Native timetable progress is
            // indexed by another planner's static stop list and cannot be reused.
            if (m.trip !== id) {
              if (value.status === "estimated")
                value = unavailableObservation("unsupported");
              else delete value.estimatedProgress;
            }
            apply(id, item, value);
          }
        }
      },
    });
    socket = connection;
    connection.connect();
  };
  const pump = () => {
    if (disposed || pending || reconnect) return;
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
        if (session.status === "available" && reconnect) {
          queue.set(id, watch);
          return;
        }
        if (tickets.size >= 100) tickets.delete(tickets.keys().next().value!);
        // A successful ticket is single-use, even if the WS session lasts 15 minutes.
        if (session.status !== "available") tickets.set(id, session);
        connect(id, watch, session);
      })
      .catch((error: unknown) => {
        if (!active(id, watch)) return;
        if (!currentObservation(id)) store.set(id, unavailableObservation());
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
    refresh(id: string) {
      const watch = watches.get(id);
      if (!watch || !active(id, watch) || !dependencies.observation) return;
      // Accordion and dialog can open together or share the same trip. Join
      // their pending read instead of aborting it and issuing duplicate HTTP.
      if (watch.snapshot) return;
      if (!currentObservation(id))
        store.set(id, unavailableObservation("connecting"));
      const controller = new AbortController();
      watch.snapshot = controller;
      const revision = watch.revision ?? 0;
      void dependencies
        .observation(id, controller.signal)
        .then((raw) => {
          if (
            active(id, watch) &&
            !controller.signal.aborted &&
            watch.snapshot === controller &&
            (watch.revision ?? 0) === revision
          ) {
            apply(id, watch, observation(raw));
          }
        })
        // A failed initial read must not tear down the socket or erase a received point.
        .catch(() => {
          if (
            active(id, watch) &&
            !controller.signal.aborted &&
            !currentObservation(id)
          )
            apply(id, watch, unavailableObservation());
        })
        .finally(() => {
          if (watch.snapshot === controller) watch.snapshot = undefined;
        });
    },
    setIds(ids: readonly string[]) {
      if (disposed) return;
      const desired = new Set(ids);
      for (const [id, watch] of watches)
        if (!desired.has(id)) {
          watches.delete(id);
          queue.delete(id);
          watch.controller.abort();
          watch.snapshot?.abort();
          clearTimeout(watch.expiry);
          clearTimeout(watch.renewal);
          if (
            watch.subscribed &&
            ready &&
            ![...watches].some(
              ([other, item]) =>
                item.subscribed &&
                (item.serverTrip ?? other) === (watch.serverTrip ?? id),
            )
          )
            socket?.send({ type: "unsubscribe", trip: watch.serverTrip ?? id });
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
      if (!watches.size) {
        clearTimeout(wake);
        clearTimeout(reconnect);
        reconnect = undefined;
        retries = 0;
        disconnect();
      }
      pump();
    },
    dispose() {
      disposed = true;
      clearTimeout(wake);
      clearTimeout(reconnect);
      disconnect();
      for (const watch of watches.values()) {
        watch.controller.abort();
        watch.snapshot?.abort();
        clearTimeout(watch.expiry);
        clearTimeout(watch.renewal);
      }
      watches.clear();
      queue.clear();
      tickets.clear();
      store.clear();
    },
  };
}
