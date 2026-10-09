let scrollDismissal = false;

export function usesTouchKeyboard() {
  return (
    navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches
  );
}

/** Blurring editable focus is the browser's portable way to dismiss its keyboard. */
export function dismissMobileKeyboard(reason?: "scroll") {
  if (!usesTouchKeyboard()) return false;
  const target = document.activeElement;
  if (
    target instanceof HTMLElement &&
    (target.matches(
      "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea",
    ) ||
      target.isContentEditable)
  ) {
    scrollDismissal = reason === "scroll";
    try {
      target.blur();
    } finally {
      scrollDismissal = false;
    }
  }
  return true;
}

export const isKeyboardScrollDismissal = () => scrollDismissal;
