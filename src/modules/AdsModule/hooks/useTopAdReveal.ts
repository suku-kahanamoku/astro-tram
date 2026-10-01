import { useEffect, useState, type RefObject } from "react";
export function useTopAdReveal(ref: RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined;
    const render = () => {
      frame = undefined;
      const bounds = element.getBoundingClientRect();
      setOffset(
        reduced.matches
          ? 0
          : Math.max(
              0,
              Math.min(window.scrollY, bounds.bottom + window.scrollY),
            ) * 0.5,
      );
    };
    const schedule = () => {
      if (frame === undefined) frame = requestAnimationFrame(render);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    reduced.addEventListener("change", schedule);
    render();
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      reduced.removeEventListener("change", schedule);
    };
  }, [ref]);
  return offset;
}
