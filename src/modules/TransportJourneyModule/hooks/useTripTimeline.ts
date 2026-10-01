import { useLayoutEffect, useState, type RefObject } from "react";
import type { TripProgress } from "../providers/tripProgress";
/** Measure the real row anchors, including wrapped labels, font loading and mobile layout. */
export function useTripTimeline(
  root: RefObject<HTMLDivElement | null>,
  progress: TripProgress | null,
  identity: unknown,
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
    if (!root.current || !progress) {
      setPlacement(null);
      return;
    }
    const element = root.current;
    const from = element.querySelector<HTMLElement>(
      `[data-trip-point="${progress.from}"]`,
    );
    const to = element.querySelector<HTMLElement>(
      `[data-trip-point="${progress.to}"]`,
    );
    if (!from || !to) {
      setPlacement(null);
      return;
    }
    const measure = () => {
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
      const top = start + (end - start) * progress.fraction;
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
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element
      .querySelectorAll(".trip-call")
      .forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [root, key, identity]);
  // Keep the same marker DOM node between measurements so CSS can animate its movement.
  return progress && placement !== null && placement.identity === identity
    ? placement.top
    : null;
}
