import { useEffect, useRef, useState } from "react";
import { themeConfig } from "../config/theme";
export function useTheme() {
  const [dark, setDark] = useState(false),
    [ready, setReady] = useState(false);
  const preference = useRef<string | null>(null);
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const valid = (v: string | null) =>
      v === themeConfig.light.name || v === themeConfig.dark.name ? v : null;
    const read = () => {
      try {
        preference.current = valid(
          localStorage.getItem(themeConfig.storageKey),
        );
      } catch {}
    };
    const apply = () => {
      const next = preference.current
        ? preference.current === themeConfig.dark.name
        : system.matches;
      const theme = next ? themeConfig.dark : themeConfig.light;
      document.documentElement.dataset.theme = theme.name;
      document.documentElement.dataset.themeMode = next ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme.color);
      setDark(next);
      setReady(true);
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
    read();
    apply();
    system.addEventListener("change", apply);
    window.addEventListener("storage", storage);
    window.addEventListener("pageshow", restore);
    window.addEventListener("tram:theme", restore);
    return () => {
      system.removeEventListener("change", apply);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("tram:theme", restore);
    };
  }, []);
  const toggle = () => {
    const next = !dark;
    preference.current = next ? themeConfig.dark.name : themeConfig.light.name;
    try {
      localStorage.setItem(themeConfig.storageKey, preference.current);
    } catch {}
    const theme = next ? themeConfig.dark : themeConfig.light;
    document.documentElement.dataset.theme = theme.name;
    document.documentElement.dataset.themeMode = next ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme.color);
    setDark(next);
    window.dispatchEvent(new Event("tram:theme"));
  };
  return { dark, ready, toggle };
}
