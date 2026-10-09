import { useEffect } from "react";
import { dismissMobileKeyboard } from "../providers/mobileKeyboard";

export function useDismissKeyboardOnScroll() {
  useEffect(() => {
    let focusedAt = 0;
    const focus = () => {
      focusedAt = performance.now();
    };
    const gesture = () => {
      dismissMobileKeyboard("scroll");
    };
    // Native input focus may pan the viewport while the keyboard opens.
    const scroll = () => {
      if (performance.now() - focusedAt > 250) gesture();
    };
    document.addEventListener("focusin", focus, true);
    document.addEventListener("scroll", scroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", gesture, {
      capture: true,
      passive: true,
    });
    document.addEventListener("wheel", gesture, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("touchmove", gesture, true);
      document.removeEventListener("wheel", gesture, true);
    };
  }, []);
}
