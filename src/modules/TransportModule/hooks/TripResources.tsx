import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { transportClient } from "../providers/client";
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
  const resources = useContext(coordinates ? CoordinatesContext : Context);
  if (!resources) throw new Error("TripResources provider is missing");
  return resources;
}
