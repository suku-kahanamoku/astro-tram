import { useLayoutEffect, useState, type RefObject } from "react";
import type { TripProgress } from "../providers/tripProgress";
/** Measure the real row anchors, including wrapped labels, font loading and mobile layout. */
export function useTripTimeline(
  root: RefObject<HTMLDivElement | null>,
  progress: TripProgress | null,
  identity: unknown,
  layout?: unknown,
) {
  const [placement, setPlacement] = useState<{
    identity: unknown;
    key: string;
    top: number;
  } | null>(null);
  const key = progress
    ? `${progress.from}:${progress.to}:${progress.fraction}`
    : "";
  useLayoutEffect(() => {
    if (!progress) {
      setPlacement(null);
      return;
    }
    let observer: ResizeObserver | undefined;
    const attach = () => {
      const element = root.current;
      if (!element) return;
      const measure = () => {
        // Closing disclosures retain their children for animation, but those are no longer anchors.
        const anchor = (index: number) =>
          [
            ...element.querySelectorAll<HTMLElement>(
              `[data-trip-point="${index}"]`,
            ),
          ].find((point) => !point.closest("[inert]"));
        const from = anchor(progress.from),
          to = anchor(progress.to);
        if (!from || !to) {
          setPlacement(null);
          return;
        }
        // Undo the dialog's entry scale: DOMRects include transforms, absolute top uses CSS pixels.
        const bounds = element.getBoundingClientRect();
        const height = parseFloat(getComputedStyle(element).height);
        const scale = height > 0 ? bounds.height / height : 1;
        if (!Number.isFinite(scale) || scale <= 0) return;
        const center = (point: HTMLElement) => {
          const rect = point.getBoundingClientRect();
          return (rect.top + rect.height / 2 - bounds.top) / scale;
        };
        const start = center(from),
          end = center(to);
        // A marker stays on the rail, including progress clamped to a leg's endpoints.
        const fraction = Math.max(0, Math.min(1, progress.fraction));
        const top = start + (end - start) * fraction;
        setPlacement((previous) =>
          previous !== null &&
          previous.identity === identity &&
          previous.key === key &&
          previous.top === top
            ? previous
            : { identity, key, top },
        );
      };
      measure();
      const resize = new ResizeObserver(measure);
      observer = resize;
      resize.observe(element);
      element
        .querySelectorAll(".trip-call")
        .forEach((row) => resize.observe(row));
    };
    // A child layout effect can run before its parent's DOM ref is attached.
    let frame = 0;
    if (root.current) attach();
    else frame = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [root, key, identity, layout]);
  // Keep the same marker DOM node between measurements so CSS can animate its movement.
  return progress && placement !== null && placement.identity === identity
    ? placement.top
    : null;
}
