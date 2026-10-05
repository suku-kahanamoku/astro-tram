import { transportClient } from "../../TransportCoreModule/providers/client";
import type { Trip } from "../../TransportCoreModule/types";
type Entry = {
  id: string;
  key: string;
  coordinates: boolean;
  trip?: Trip;
  pending: Promise<Trip>;
  controller: AbortController;
  resolve: (trip: Trip) => void;
  reject: (reason: unknown) => void;
};
export function createTripResources(
  loadTrip: typeof transportClient.trip = transportClient.trip,
  loadCoordinates: typeof transportClient.tripCoordinates = transportClient.tripCoordinates,
) {
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let active = 0,
    disposed = false;
  const pump = () => {
    while (!disposed && active < 2 && queue.length) {
      const entry = queue.shift()!;
      active++;
      const loader = entry.coordinates ? loadCoordinates : loadTrip;
      void loader(entry.id, entry.controller.signal)
        .then(
          (trip) => {
            entry.trip = trip;
            entry.resolve(trip);
          },
          (error) => {
            if (entries.get(entry.key) === entry) entries.delete(entry.key);
            entry.reject(error);
          },
        )
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  const load = (
    id: string,
    priority = true,
    coordinates = false,
  ): Promise<Trip> => {
    const key = `${coordinates ? "coordinates" : "static"}:${id}`;
    const previous = entries.get(key);
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
      key,
      coordinates,
      pending,
      resolve,
      reject,
      controller: new AbortController(),
    };
    if (entries.size >= 100) {
      const oldest = [...entries].find(([, cached]) => cached.trip);
      if (oldest) entries.delete(oldest[0]);
    }
    entries.set(key, entry);
    const enqueue = () => {
      if (disposed) {
        entry.reject(new Error("disposed"));
        return;
      }
      if (priority) queue.unshift(entry);
      else queue.push(entry);
      pump();
    };
    if (coordinates) {
      // Join the static read first. Native details often already contain every
      // coordinate; online details may need a separate enrichment request.
      // Waiting here does not occupy a queue slot and cannot block that read.
      void load(id, priority).then(
        (trip) => {
          if (
            trip.stops.length > 0 &&
            trip.stops.every(
              ({ stop }) =>
                typeof stop.lat === "number" &&
                Number.isFinite(stop.lat) &&
                Math.abs(stop.lat) <= 90 &&
                typeof stop.lon === "number" &&
                Number.isFinite(stop.lon) &&
                Math.abs(stop.lon) <= 180,
            )
          ) {
            entry.trip = trip;
            entry.resolve(trip);
          } else enqueue();
        },
        (error) => {
          if (entries.get(key) === entry) entries.delete(key);
          entry.reject(error);
        },
      );
    } else enqueue();
    return pending;
  };
  return {
    peek: (id: string, coordinates = false) =>
      entries.get(`${coordinates ? "coordinates" : "static"}:${id}`)?.trip,
    load,
    dispose() {
      disposed = true;
      queue.splice(0).forEach((entry) => entry.reject(new Error("disposed")));
      entries.forEach((entry) => entry.controller.abort());
      entries.clear();
    },
  };
}
