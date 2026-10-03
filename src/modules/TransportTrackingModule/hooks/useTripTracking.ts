import { useEffect, useMemo, useRef } from "react";
import { createTrackingStore } from "../providers/trackingStore";
import { createTrackingSubscriptions } from "../providers/trackingSubscriptions";
/** Keep existing watches when another accordion or dialog changes its subscriptions. */
export function useTripTracking(ids: string[], focusedId?: string | null) {
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
  useEffect(() => {
    if (!focusedId) return;
    const refresh = () => {
      if (!document.hidden) manager.current?.refresh(focusedId);
    };
    refresh();
    // Other effects may reorder visibility listeners as accordion subscriptions change.
    // Resume the watch first, then request the dialog's initial point.
    const onVisibility = () => queueMicrotask(refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [focusedId]);
  return store;
}
