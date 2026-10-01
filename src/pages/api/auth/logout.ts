/**
 * `POST /api/auth/logout/` vyžaduje existující relaci v cookie, ruší ji na
 * straně php-core a cookie smaže. Viz `AuthModule/server/logout.ts`.
 */
export { logoutHandler as POST } from "../../../modules/AuthModule/server/logout";
