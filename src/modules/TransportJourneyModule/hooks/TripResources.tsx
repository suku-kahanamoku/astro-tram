import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { transportClient } from "../../TransportCoreModule/providers/client";
import { createTripResources } from "../providers/tripResources";
const CoordinatesContext = createContext<ReturnType<
  typeof createTripResources
> | null>(null);
const Context = createContext<ReturnType<typeof createTripResources> | null>(
  null,
);
/** Only this search view owns static trip details. No GPS or browser storage. */
export function TripResources({ children }: { children: ReactNode }) {
  const resources = useMemo(() => createTripResources(), []);
  const coordinates = useMemo(
    () => createTripResources(transportClient.tripCoordinates),
    [],
  );
  useEffect(
    () => () => {
      resources.dispose();
      coordinates.dispose();
    },
    [resources, coordinates],
  );
  return (
    <Context.Provider value={resources}>
      <CoordinatesContext.Provider value={coordinates}>
        {children}
      </CoordinatesContext.Provider>
    </Context.Provider>
  );
}
export function useTripResources(coordinates = false) {
  const base = useContext(Context);
  const enriched = useContext(CoordinatesContext);
  const shared = useMemo(() => {
    if (!base || !enriched) return null;
    const resources = coordinates ? enriched : base;
    const alternate = coordinates ? base : enriched;
    const peek = (id: string) => {
      const own = resources.peek(id);
      if (own) return own;
      const cached = alternate.peek(id);
      // A complete coordinate response is also a static detail. Conversely,
      // reuse a base detail for GPS only when all its stop coordinates exist.
      return cached &&
        (!coordinates ||
          cached.stops.every(
            ({ stop }) => stop.lat !== null && stop.lon !== null,
          ))
        ? cached
        : undefined;
    };
    return {
      ...resources,
      peek,
      load(id: string, priority = true) {
        const cached = peek(id);
        return cached ? Promise.resolve(cached) : resources.load(id, priority);
      },
    };
  }, [base, enriched, coordinates]);
  if (!shared) throw new Error("TripResources provider is missing");
  return shared;
}
