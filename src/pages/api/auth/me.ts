/**
 * `GET /api/auth/me/` čte výhradně HttpOnly cookie relace a vrací jen vybrané
 * veřejné údaje uživatele. Viz `AuthModule/server/me.ts`.
 */
export { meHandler as GET } from "../../../modules/AuthModule/server/me";
