import { useEffect, useRef, type RefObject } from "react";

/** Scroll once per content key; layout anchoring ends when the user interacts. */
export function useScrollOnContent(
  target: RefObject<HTMLElement | null>,
  content: unknown,
  blocked = false,
  behavior: ScrollBehavior = "smooth",
  keepAnchor = false,
) {
  const visited = useRef<unknown>(null);
  useEffect(() => {
    if (!content || visited.current === content) return;
    // A deep link opening a dialog must not move its background after dismissal.
    if (blocked) {
      visited.current = content;
      return;
    }
    let observer: ResizeObserver | undefined;
    let adjustment = 0;
    const stopAnchoring = () => {
      observer?.disconnect();
      cancelAnimationFrame(adjustment);
    };
    const gestures = [
      "pointerdown",
      "touchstart",
      "wheel",
      "keydown",
      "focusin",
    ] as const;
    const frame = requestAnimationFrame(() => {
      if (!target.current) return;
      visited.current = content;
      target.current.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : behavior,
      });
      if (keepAnchor) {
        // Async form fields and results can move the anchor, or make an initially
        // clamped scroll possible. Keep it in place until the user interacts.
        const top =
          parseFloat(getComputedStyle(target.current).scrollMarginTop) || 0;
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(adjustment);
          adjustment = requestAnimationFrame(() => {
            if (!target.current) return;
            const delta = target.current.getBoundingClientRect().top - top;
            if (Math.abs(delta) > 1)
              window.scrollBy({ top: delta, behavior: "instant" });
          });
        });
        observer.observe(document.body);
        gestures.forEach((event) =>
          document.addEventListener(event, stopAnchoring, {
            capture: true,
            passive: true,
          }),
        );
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      stopAnchoring();
      gestures.forEach((event) =>
        document.removeEventListener(event, stopAnchoring, true),
      );
    };
  }, [target, content, blocked, behavior, keepAnchor]);
}
