import { useEffect, useRef, useState } from "react";
export function useNavigation() {
  const toggle = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    const options = { signal: abort.signal };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = () => {
      clearTimeout(timer);
      setOpen(false);
    };
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (toggle.current?.contains(target) || menu.current?.contains(target));
    const pointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.type === "pointerout" ? e.relatedTarget : e.target;
      if (inside(target)) {
        clearTimeout(timer);
        timer = undefined;
      } else if (timer === undefined) timer = setTimeout(close, 180);
    };
    document.addEventListener("pointermove", pointer, options);
    document.addEventListener(
      "pointerout",
      (e) => {
        if (!e.relatedTarget) pointer(e);
      },
      options,
    );
    document.addEventListener(
      "click",
      (e) => {
        if (!inside(e.target)) close();
      },
      options,
    );
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          close();
          toggle.current?.focus();
        }
      },
      options,
    );
    matchMedia("(min-width: 1280px)").addEventListener(
      "change",
      (e) => {
        if (e.matches) close();
      },
      options,
    );
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [open]);
  return { open, setOpen, toggle, menu };
}
