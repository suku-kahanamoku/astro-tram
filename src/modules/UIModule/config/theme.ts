export const themeConfig = {
  storageKey: "tram-theme",
  light: { name: "tram", color: "#fff8ee" },
  dark: { name: "tram", color: "#fff8ee" },
} as const;
export const defaultTheme = themeConfig.light;
export type ThemeMode = "light" | "dark";
