import { useEffect, useRef, useState } from "react";
/** A disclosure owns its state and cleans up its outside-click and Escape listeners. */
export function useDisclosure() {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        setOpen(false);
        ref.current?.querySelector("summary")?.focus();
      } else if (e.target instanceof Node && !ref.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("click", close);
    };
  }, [open]);
  return { ref, open, setOpen };
}
