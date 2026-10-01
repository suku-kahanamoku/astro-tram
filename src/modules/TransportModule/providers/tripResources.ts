import { transportClient } from "./client";
import type { Trip } from "../types";
type Entry = {
  id: string;
  trip?: Trip;
  pending: Promise<Trip>;
  controller: AbortController;
  resolve: (trip: Trip) => void;
  reject: (reason: unknown) => void;
};
export function createTripResources(
  loadTrip: typeof transportClient.trip = transportClient.trip,
) {
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let active = 0,
    disposed = false;
  const pump = () => {
    while (!disposed && active < 2 && queue.length) {
      const entry = queue.shift()!;
      active++;
      void loadTrip(entry.id, entry.controller.signal)
        .then(
          (trip) => {
            entry.trip = trip;
            entry.resolve(trip);
          },
          (error) => {
            if (entries.get(entry.id) === entry) entries.delete(entry.id);
            entry.reject(error);
          },
        )
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return {
    peek: (id: string) => entries.get(id)?.trip,
    load(id: string, priority = true) {
      const previous = entries.get(id);
      if (previous) {
        const index = queue.indexOf(previous);
        if (priority && index > 0) {
          queue.splice(index, 1);
          queue.unshift(previous);
        }
        return previous.pending;
      }
      if (disposed) return Promise.reject(new Error("disposed"));
      let resolve!: Entry["resolve"], reject!: Entry["reject"];
      const pending = new Promise<Trip>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const entry: Entry = {
        id,
        pending,
        resolve,
        reject,
        controller: new AbortController(),
      };
      if (entries.size >= 100) {
        const oldest = [...entries].find(([, cached]) => cached.trip);
        if (oldest) entries.delete(oldest[0]);
      }
      entries.set(id, entry);
      if (priority) queue.unshift(entry);
      else queue.push(entry);
      pump();
      return pending;
    },
    dispose() {
      disposed = true;
      queue.splice(0).forEach((entry) => entry.reject(new Error("disposed")));
      entries.forEach((entry) => entry.controller.abort());
      entries.clear();
    },
  };
}
