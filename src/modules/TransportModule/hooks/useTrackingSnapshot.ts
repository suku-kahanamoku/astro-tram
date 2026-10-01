import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createTrackingStore,
  type Observations,
} from "../providers/trackingStore";
import { trackedJourney } from "../providers/tracking";
import type { Journey } from "../types";
export const TrackingContext = createContext(createTrackingStore());
/** Only the consumer of this trip's live fields rerenders when its observation changes. */
export function useTripObservation(id?: string | null) {
  const store = useContext(TrackingContext);
  return useSyncExternalStore(
    store.subscribe,
    () => (id ? store.getSnapshot()[id] : undefined),
    () => undefined,
  );
}
export function usePredictionExpiry(deadlines: (string | null | undefined)[]) {
  const [revision, refresh] = useState(0);
  const key = JSON.stringify(deadlines);
  useEffect(() => {
    const future = (JSON.parse(key) as (string | null)[]).flatMap((value) =>
      value && Date.parse(value) > Date.now() ? [Date.parse(value)] : [],
    );
    if (!future.length) return;
    const timer = setTimeout(
      () => refresh((value) => value + 1),
      Math.max(1, Math.min(...future) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [key, revision]);
}
/** Timing is a read-only projection used by small time/status components, never to sort the list. */
export function useJourneyTiming(journey: Journey) {
  const store = useContext(TrackingContext);
  const select = useMemo(() => {
    const ids = [
      ...new Set(
        journey.legs.flatMap((leg) => (leg.tripId ? [leg.tripId] : [])),
      ),
    ];
    let previous: Observations = {};
    return () => {
      const snapshot = store.getSnapshot();
      if (ids.every((id) => snapshot[id] === previous[id])) return previous;
      previous = Object.fromEntries(
        ids.flatMap((id) => (snapshot[id] ? [[id, snapshot[id]]] : [])),
      );
      return previous;
    };
  }, [store, journey]);
  const observations = useSyncExternalStore(
    store.subscribe,
    select,
    store.getServerSnapshot,
  );
  usePredictionExpiry(journey.legs.map((leg) => leg.predictionValidUntil));
  return trackedJourney(journey, observations);
}
