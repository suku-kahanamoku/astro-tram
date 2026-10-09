import { transportClient } from "../../TransportCoreModule/providers/client";
import { StaticResponseCache } from "../../TransportCoreModule/providers/staticResponseCache";
import type { Trip } from "../../TransportCoreModule/types";
export const tripResourceLimits = {
  entries: 100,
  bytes: 8 * 1024 * 1024,
  concurrency: 2,
};
type Entry = {
  id: string;
  key: string;
  coordinates: boolean;
  trip?: Trip;
  bytes: number;
  pending: Promise<Trip>;
  controller: AbortController;
  resolve: (trip: Trip) => void;
  reject: (reason: unknown) => void;
};
export function createTripResources(
  loadTrip: typeof transportClient.trip = transportClient.trip,
  loadCoordinates: typeof transportClient.tripCoordinates = transportClient.tripCoordinates,
  limits = tripResourceLimits,
) {
  const byteLimit = limits.bytes;
  let cachedBytes = 0;
  const entries = new Map<string, Entry>();
  const queue: Entry[] = [];
  let active = 0,
    disposed = false;
  const remove = (key: string, entry: Entry) => {
    if (entries.get(key) !== entry) return;
    entries.delete(key);
    cachedBytes -= entry.bytes;
  };
  const remember = (entry: Entry, trip: Trip) => {
    if (disposed || entries.get(entry.key) !== entry) return;
    if (!StaticResponseCache.isStatic(trip)) {
      remove(entry.key, entry);
      return;
    }
    entry.trip = trip;
    entry.bytes = new TextEncoder().encode(JSON.stringify(trip)).length;
    cachedBytes += entry.bytes;
    for (const [key, cached] of entries) {
      if (cachedBytes <= byteLimit && entries.size <= limits.entries) break;
      if (cached.trip) remove(key, cached);
    }
  };
  const pump = () => {
    while (!disposed && active < limits.concurrency && queue.length) {
      const entry = queue.shift()!;
      active++;
      const loader = entry.coordinates ? loadCoordinates : loadTrip;
      void loader(entry.id, entry.controller.signal)
        .then(
          (trip) => {
            remember(entry, trip);
            entry.resolve(trip);
          },
          (error) => {
            remove(entry.key, entry);
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
      bytes: 0,
    };
    if (entries.size >= limits.entries) {
      const oldest = [...entries].find(([, cached]) => cached.trip);
      if (oldest) remove(oldest[0], oldest[1]);
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
            remember(entry, trip);
            entry.resolve(trip);
          } else enqueue();
        },
        (error) => {
          remove(key, entry);
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
      cachedBytes = 0;
    },
  };
}
