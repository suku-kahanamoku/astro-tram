import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import {
  readState,
  writeState,
} from "../../TransportCoreModule/providers/state";
import { createTripResources } from "../providers/tripResources";
const Context = createContext<ReturnType<typeof createTripResources> | null>(
  null,
);
/** One search owns one queue/cache for static details, including public stop coordinates. */
export function TripResources({ children }: { children: ReactNode }) {
  const { url } = useUrlNavigation();
  const scope = writeState(readState(url.searchParams)).toString();
  const resources = useMemo(() => createTripResources(), [scope]);
  useEffect(() => () => resources.dispose(), [resources]);
  return <Context.Provider value={resources}>{children}</Context.Provider>;
}
/** Both timeline and detail join the same pending request, not only completed cache entries. */
export function useTripResources() {
  const resources = useContext(Context);
  if (!resources) throw new Error("TripResources provider is missing");
  return resources;
}
