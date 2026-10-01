/**
 * `POST /api/auth/login/` je veřejná mutace bez přihlášení: validuje vstup
 * předávaný php-core a po úspěchu založí relaci v HttpOnly cookie.
 * Viz `AuthModule/server/login.ts`, kde je celý handler i jeho dokumentace.
 */
export { loginHandler as POST } from "../../../modules/AuthModule/server/login";
