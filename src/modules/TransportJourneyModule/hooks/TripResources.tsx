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
/** One search owns one queue/cache for static details, including public stop coordinates. */
export function TripResources({ children }: { children: ReactNode }) {
  const resources = useMemo(() => createTripResources(), []);
  useEffect(() => () => resources.dispose(), [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
/** Both timeline and detail join the same pending request, not only completed cache entries. */
export function useTripResources() {
  const resources = useContext(Context);
  if (!resources) throw new Error("TripResources provider is missing");
  return resources;
}
