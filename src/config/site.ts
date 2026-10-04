import { defaultTheme } from "../modules/UIModule/config/theme";
export const site = {
  name: "TRAM",
  email: "",
  theme: defaultTheme,
  modules: { auth: true, ads: false, realtime: false },
} as const;
