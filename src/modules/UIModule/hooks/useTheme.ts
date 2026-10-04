import { useCallback, useEffect, useRef, useState } from "react";
import { themeConfig, type ThemeMode } from "../config/theme";
export function useTheme() {
  const [dark, setDark] = useState(false),
    [ready, setReady] = useState(false);
  const preference = useRef<ThemeMode | null>(null);
  const applyTheme = useCallback((mode: ThemeMode) => {
    const theme = themeConfig[mode];
    document.documentElement.dataset.theme = theme.name;
    document.documentElement.dataset.themeMode = mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.color);
    setDark(mode === "dark");
    setReady(true);
  }, []);
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    // A brand name (both modes are "tram") cannot identify a light/dark preference.
    const valid = (v: unknown): ThemeMode | null =>
      v === "light" || v === "dark" ? v : null;
    const read = () => {
      try {
        preference.current = valid(
          localStorage.getItem(themeConfig.storageKey),
        );
      } catch {}
    };
    const apply = () => {
      applyTheme(preference.current ?? (system.matches ? "dark" : "light"));
    };
    const storage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== themeConfig.storageKey) return;
      preference.current = valid(e.newValue);
      apply();
    };
    const restore = () => {
      read();
      apply();
    };
    const changed = (event: Event) => {
      const mode = valid(event instanceof CustomEvent ? event.detail : null);
      if (mode) {
        preference.current = mode;
        apply();
      } else restore();
    };
    read();
    apply();
    system.addEventListener("change", apply);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", restore);
    window.addEventListener("tram:theme", changed);
    return () => {
      system.removeEventListener("change", apply);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("tram:theme", changed);
    };
  }, [applyTheme]);
  const toggle = () => {
    const next = !dark;
    const mode = next ? "dark" : "light";
    preference.current = mode;
    try {
      localStorage.setItem(themeConfig.storageKey, preference.current);
    } catch {}
    applyTheme(mode);
    window.dispatchEvent(new CustomEvent("tram:theme", { detail: mode }));
  };
  return { dark, ready, toggle };
}
