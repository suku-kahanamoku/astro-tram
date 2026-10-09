import { defaultTheme } from "../modules/UIModule/config/theme";
export const site = {
  name: "Trambus",
  logo: "/favicon.svg",
  email: "info@prasentace.cz",
  phone: "+420 722 767 646",
  registrationId: "04473442",
  theme: defaultTheme,
  modules: { auth: true, ads: false, realtime: false },
} as const;
