import type { APIRoute } from "astro";
import { HttpError, errorResponse } from "../../CoreModule/server/errors";
import { readFields } from "../../CoreModule/server/request";
import {
  validCoordinates,
  validInstant,
} from "../../TransportCoreModule/providers/state";
function fail(): never {
  throw new HttpError(422, "invalid_input");
}
const plain = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : fail();
export const coverage: APIRoute = async ({ locals }) => {
  try {
    return Response.json({
      success: true,
      data: await locals.providers.transport.coverage(),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
export function validateSearch(body: Record<string, unknown>) {
  const allowed = [
    "from-dest",
    "to-dest",
    "from-date",
    "to-date",
    "state",
    "city",
    "location",
    "max-transfers",
    "limit",
  ];
  if (Object.keys(body).some((key) => !allowed.includes(key))) fail();
  const place = (input: unknown) => {
    const p = plain(input);
    if (
      p.type === "stop" &&
      typeof p.id === "string" &&
      /^[A-Za-z0-9_-]{1,2048}$/.test(p.id)
    )
      return { type: "stop", id: p.id };
    if (
      (p.type !== "coordinates" && p.type !== "current_location") ||
      typeof p.lat !== "number" ||
      typeof p.lon !== "number" ||
      !validCoordinates(p.lat, p.lon)
    )
      return fail();
    if (p.type === "current_location") {
      const at = p["observed-at"];
      if (!validInstant(at)) return fail();
      const age = Date.now() - Date.parse(at);
      if (age > 30000 || age < -5000)
        throw new HttpError(422, "stale_location");
      return { type: p.type, lat: p.lat, lon: p.lon, "observed-at": at };
    }
    return { type: p.type, lat: p.lat, lon: p.lon };
  };
  if ((body["from-date"] !== undefined) === (body["to-date"] !== undefined))
    fail();
  const dateKey = body["from-date"] !== undefined ? "from-date" : "to-date";
  if (!validInstant(body[dateKey])) fail();
  if (
    body.state !== undefined &&
    (typeof body.state !== "string" || !/^[A-Z]{2}$/.test(body.state))
  )
    fail();
  if (
    body.city !== undefined &&
    (typeof body.city !== "string" ||
      !body.city.trim() ||
      body.city.length > 120)
  )
    fail();
  if (
    body.location !== undefined &&
    plain(body.location).type !== "current_location"
  )
    fail();
  if (![0, 5].includes(body["max-transfers"] as number) || body.limit !== 10)
    fail();
  return {
    "from-dest": place(body["from-dest"]),
    "to-dest": place(body["to-dest"]),
    [dateKey]: body[dateKey],
    ...(body.state ? { state: body.state } : {}),
    ...(body.city ? { city: body.city } : {}),
    ...(body.location ? { location: place(body.location) } : {}),
    "max-transfers": body["max-transfers"],
    limit: 10,
  };
}
export const search: APIRoute = async ({ request, locals }) => {
  try {
    const body = validateSearch(await readFields(request));
    return Response.json({
      success: true,
      data: await locals.providers.transport.search(body),
    });
  } catch (error) {
    return errorResponse(error);
  }
};
/** Standard q filter at the public boundary; forward only allowed fields to the shared php-core places search endpoint. */
export const places: APIRoute = async ({ url, request, locals }) => {
  try {
    if (url.search.length > 1500) fail();
    let q: Record<string, unknown>;
    try {
      q =
        request.method === "POST"
          ? plain((await readFields(request)).q)
          : plain(JSON.parse(url.searchParams.get("q") ?? "{}"));
    } catch {
      return fail();
    }
    if (
      Object.keys(q).some(
        (k) =>
          ![
            "name",
            "state",
            "city",
            "latitude",
            "longitude",
            "observed_at",
          ].includes(k),
      )
    )
      fail();
    let query: string | null = null;
    if (q.name !== undefined) {
      const name = plain(q.name);
      if (
        Object.keys(name).length !== 1 ||
        typeof name.$regex !== "string" ||
        name.$regex.trim().length < 2 ||
        name.$regex.length > 120
      )
        fail();
      query = name.$regex.trim();
    }
    const country = q.state ?? "";
    if (
      typeof country !== "string" ||
      (country !== "" && !/^[A-Z]{2}$/.test(country))
    )
      fail();
    const city = q.city ?? "";
    if (typeof city !== "string" || city.length > 120) fail();
    let location: { lat: number; lon: number; observedAt: string } | undefined;
    if (
      q.latitude !== undefined ||
      q.longitude !== undefined ||
      q.observed_at !== undefined
    ) {
      if (
        request.method !== "POST" ||
        typeof q.latitude !== "number" ||
        typeof q.longitude !== "number" ||
        !validCoordinates(q.latitude, q.longitude) ||
        !validInstant(q.observed_at)
      )
        fail();
      const age = Date.now() - Date.parse(q.observed_at);
      if (age > 30000 || age < -5000)
        throw new HttpError(422, "stale_location");
      location = {
        lat: q.latitude,
        lon: q.longitude,
        observedAt: q.observed_at,
      };
    }
    if (query === null && !location) fail();
    const result = await locals.providers.transport.places(
      query,
      country,
      city.trim(),
      location,
    );
    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
};
export const trip: APIRoute = async ({ url, locals }) => {
  try {
    const id = url.searchParams.get("id") ?? "";
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(id)) fail();
    return Response.json({
      success: true,
      data: await locals.providers.transport.trip(
        id,
        url.searchParams.get("coordinates") === "1",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
};

export const stop: APIRoute = async ({ url, locals }) => {
  try {
    const id = url.searchParams.get("id") ?? "";
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(id)) fail();
    return Response.json({
      success: true,
      data: await locals.providers.transport.stop(id),
    });
  } catch (error) {
    return errorResponse(error);
  }
};

/** Complete provider city catalogue, scoped to the selected country. */
export const cities: APIRoute = async ({ url, locals }) => {
  try {
    if (url.search.length > 300) fail();
    let q: Record<string, unknown>;
    try {
      q = plain(JSON.parse(url.searchParams.get("q") ?? "{}"));
    } catch {
      return fail();
    }
    if (
      Object.keys(q).some((k) => k !== "state") ||
      typeof q.state !== "string" ||
      !/^[A-Z]{2}$/.test(q.state)
    )
      fail();
    return Response.json({
      success: true,
      ...(await locals.providers.transport.cities(q.state as string)),
    });
  } catch (error) {
    return errorResponse(error);
  }
};

/** Current trip observation, independent of the static detail and socket ticket queue. */
export const observation: APIRoute = async ({ url, locals }) => {
  try {
    const id = url.searchParams.get("id") ?? "";
    if (!/^[A-Za-z0-9_-]{1,2048}$/.test(id)) return fail();
    return Response.json(
      { success: true, data: await locals.providers.transport.observation(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
};

/** Trip-bound ephemeral ticket; same-origin POST, no coordinates or credentials in URLs. */
export const tracking: APIRoute = async ({ request, locals }) => {
  try {
    const body = await readFields(request);
    const id = body.id;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,2048}$/.test(id))
      return fail();
    return Response.json(
      { success: true, data: await locals.providers.transport.tracking(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
