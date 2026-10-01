import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { transportClient } from "../providers/client";
import type { Trip } from "../types";
type Entry = {
  trip?: Trip;
  pending: Promise<Trip>;
  controller: AbortController;
};
function createResources() {
  const entries = new Map<string, Entry>();
  return {
    peek: (id: string) => entries.get(id)?.trip,
    load(id: string) {
      const previous = entries.get(id);
      if (previous) return previous.pending;
      const controller = new AbortController();
      const entry: Entry = {
        controller,
        pending: transportClient.trip(id, controller.signal),
      };
      if (entries.size >= 100) {
        const oldest = [...entries].find(([, cached]) => cached.trip);
        if (oldest) entries.delete(oldest[0]);
      }
      entries.set(id, entry);
      entry.pending = entry.pending.then(
        (trip) => {
          entry.trip = trip;
          return trip;
        },
        (error) => {
          entries.delete(id);
          throw error;
        },
      );
      return entry.pending;
    },
    dispose() {
      entries.forEach((entry) => entry.controller.abort());
      entries.clear();
    },
  };
}
const Context = createContext<ReturnType<typeof createResources> | null>(null);
/** Only this search view owns static trip details. No GPS or browser storage. */
export function TripResources({ children }: { children: ReactNode }) {
  const resources = useMemo(createResources, []);
  useEffect(() => () => resources.dispose(), [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
export function useTripResources() {
  const resources = useContext(Context);
  if (!resources) throw new Error("TripResources provider is missing");
  return resources;
}
