import type { TripObservation } from "../../TransportCoreModule/types";
export type Observations = Readonly<Record<string, TripObservation>>;
const empty: Observations = Object.freeze({});
/** Ephemeral observations only. Search results, selection and timetable data never enter this store. */
export function createTrackingStore() {
  let values = empty;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    getSnapshot: () => values,
    getServerSnapshot: () => empty,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (id: string, value: TripObservation) => {
      values = { ...values, [id]: value };
      notify();
    },
    remove: (id: string) => {
      if (!(id in values)) return;
      const next = { ...values };
      delete next[id];
      values = next;
      notify();
    },
    clear: () => {
      if (values === empty) return;
      values = empty;
      notify();
    },
  };
}
export type TrackingStore = ReturnType<typeof createTrackingStore>;
