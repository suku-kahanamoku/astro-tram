import { useEffect, useRef, type RefObject } from "react";

/** Scroll once for each newly loaded result, never for disclosure or live updates. */
export function useScrollOnContent(
  target: RefObject<HTMLElement | null>,
  content: unknown,
  blocked = false,
) {
  const visited = useRef<unknown>(null);
  useEffect(() => {
    if (!content || visited.current === content) return;
    // A deep link opening a dialog must not move its background after dismissal.
    if (blocked) {
      visited.current = content;
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (!target.current) return;
      visited.current = content;
      target.current.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [target, content, blocked]);
}
