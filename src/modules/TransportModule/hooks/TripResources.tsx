import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createTripResources } from "../providers/tripResources";
const Context = createContext<ReturnType<typeof createTripResources> | null>(
  null,
);
/** Only this search view owns static trip details. No GPS or browser storage. */
export function TripResources({ children }: { children: ReactNode }) {
  const resources = useMemo(() => createTripResources(), []);
  useEffect(() => () => resources.dispose(), [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
export function useTripResources() {
  const resources = useContext(Context);
  if (!resources) throw new Error("TripResources provider is missing");
  return resources;
}
