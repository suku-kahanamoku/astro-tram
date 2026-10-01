import { useEffect, useMemo, useRef } from "react";
import { createTrackingStore } from "../providers/trackingStore";
import { createTrackingSubscriptions } from "../providers/trackingSubscriptions";
/** Keep existing watches when another accordion or dialog changes its subscriptions. */
export function useTripTracking(ids: string[]) {
  const key = JSON.stringify([...new Set(ids)].sort());
  const store = useMemo(() => createTrackingStore(), []);
  const manager = useRef<ReturnType<typeof createTrackingSubscriptions> | null>(
    null,
  );
  useEffect(() => {
    const subscriptions = createTrackingSubscriptions(store);
    manager.current = subscriptions;
    return () => {
      subscriptions.dispose();
      manager.current = null;
    };
  }, [store]);
  useEffect(() => {
    const update = () =>
      manager.current?.setIds(document.hidden ? [] : JSON.parse(key));
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [key]);
  return store;
}
