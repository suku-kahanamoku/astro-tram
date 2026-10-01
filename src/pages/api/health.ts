import type { APIRoute } from "astro";

/**
 * `GET /api/health` – kontrola živosti aplikace.
 *
 * Bez vstupu, bez autentizace a bez dotyku php-core; jde pouze o to, zda
 * proces odpovídá. Dostupnost php-core ani jeho databáze tím není garantována,
 * proto se health nepropírá do monitoringu dostupnosti backendu.
 *
 * Odpověď: `Response.json({ success: true, data: { status: "ok" } })`.
 */
export const GET: APIRoute = () =>
  Response.json({ success: true, data: { status: "ok" } });
