import { useEffect, useMemo, useRef } from "react";
import { createTrackingStore } from "../providers/trackingStore";
import { createTrackingSubscriptions } from "../providers/trackingSubscriptions";
/** Keep existing watches when another accordion or dialog changes its subscriptions. */
export function useTripTracking(
  ids: string[],
  focusedId?: string | null,
  opened: { key: string; ids: string[] }[] = [],
) {
  const key = JSON.stringify([...new Set(ids)].sort());
  const openings = JSON.stringify(opened);
  const previous = useRef(new Set<string>());
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
    const groups = JSON.parse(openings) as typeof opened;
    const refresh = (all = false) => {
      if (document.hidden) return;
      const trips = new Set(
        groups
          .filter((group) => all || !previous.current.has(group.key))
          .flatMap((group) => group.ids),
      );
      previous.current = new Set(groups.map((group) => group.key));
      for (const id of trips) manager.current?.refresh(id);
    };
    refresh();
    // Restore subscriptions before refreshing every visible accordion.
    const onVisibility = () => queueMicrotask(() => refresh(true));
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [openings]);
  useEffect(() => {
    if (!focusedId) return;
    const refresh = () => {
      if (!document.hidden) manager.current?.refresh(focusedId);
    };
    refresh();
    // Other effects may reorder visibility listeners as accordion subscriptions change.
    // Resume the watch first, then request the dialog's initial GPS and delay.
    const onVisibility = () => queueMicrotask(refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [focusedId]);
  return store;
}
