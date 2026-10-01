import {
  tripFeatures,
  reservationLabels,
  type TripFeature,
} from "../config/tripFeatures";
import { createHash } from "node:crypto";
import type { CoreClient } from "../../CoreModule/server/php-core";
import { HttpError } from "../../CoreModule/server/errors";
import type {
  Geometry,
  Journey,
  Leg,
  PlaceOption,
  Stop,
  Trip,
  SearchResult,
  TripMetadata,
} from "../types";
import { validCoordinates, validInstant } from "../providers/state";
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max = 200) =>
  typeof value === "string" ? value.slice(0, max) : "";
const instant = (value: unknown) => (validInstant(value) ? value : null);
const id = (value: unknown) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,2048}$/.test(value)
    ? value
    : null;
function tripMetadata(value: unknown, operatorValue: unknown): TripMetadata {
  const m = object(value),
    operator = object(m.operator ?? operatorValue);
  return {
    features: [
      ...new Set(
        (Array.isArray(m.features) ? m.features : []).filter(
          (v): v is TripFeature =>
            typeof v === "string" && Object.hasOwn(tripFeatures, v),
        ),
      ),
    ],
    accessibility:
      m.accessibility === "accessible" || m.accessibility === "partial"
        ? m.accessibility
        : null,
    reservations: Object.fromEntries(
      Object.entries(object(m.reservations)).filter(
        ([kind, policy]) =>
          Object.hasOwn(reservationLabels, kind) &&
          (policy === "available" || policy === "mandatory"),
      ),
    ) as TripMetadata["reservations"],
    line: text(m.line, 80) || null,
    number: text(m.number, 80) || null,
    name: text(m.name, 512) || null,
    serviceDate:
      typeof m.service_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(m.service_date)
        ? m.service_date
        : null,
    operator: text(operator.name)
      ? {
          name: text(operator.name),
          city: text(operator.city) || null,
          url: text(operator.url, 2048) || null,
          phone: text(operator.phone, 80) || null,
        }
      : null,
    notes: (Array.isArray(m.notes) ? m.notes : [])
      .slice(0, 60)
      .map((value) => {
        const n = object(value);
        const texts = Object.fromEntries(
          Object.entries(object(n.texts))
            .slice(0, 10)
            .filter(
              ([language, value]) =>
                /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) &&
                typeof value === "string",
            )
            .map(([language, value]) => [language, text(value, 4000)]),
        );
        return {
          scope: n.scope === "line" ? ("line" as const) : ("trip" as const),
          category:
            n.category === "technical"
              ? ("technical" as const)
              : ("passenger" as const),
          texts,
          defaultLanguage: text(n.default_language, 35) || null,
        };
      })
      .filter((n) => Object.keys(n.texts).length),
  };
}
function stop(value: unknown): Stop {
  const p = object(value);
  return {
    id: id(p.id),
    name: text(p.name),
    lat: typeof p.lat === "number" && Math.abs(p.lat) <= 90 ? p.lat : null,
    lon: typeof p.lon === "number" && Math.abs(p.lon) <= 180 ? p.lon : null,
    platform: text(p.platform, 30) || null,
  };
}
function geometry(value: unknown): Geometry | null {
  const g = object(value);
  if (
    g.type !== "LineString" ||
    !Array.isArray(g.coordinates) ||
    g.coordinates.length > 20000
  )
    return null;
  const coordinates = g.coordinates;
  if (
    !coordinates.every(
      (p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        typeof p[0] === "number" &&
        typeof p[1] === "number" &&
        validCoordinates(p[1], p[0]),
    )
  )
    return null;
  return {
    type: "LineString",
    coordinates: coordinates.map((p) => [p[0], p[1]]),
  };
}
function leg(value: unknown): Leg {
  const l = object(value);
  if (
    !validInstant(l.scheduled_departure) ||
    !validInstant(l.scheduled_arrival)
  )
    throw new HttpError(502, "invalid_backend_response");
  return {
    mode: text(l.mode, 30),
    from: stop(l.from),
    to: stop(l.to),
    scheduledDeparture: l.scheduled_departure,
    scheduledArrival: l.scheduled_arrival,
    expectedDeparture:
      l.realtime === true ? instant(l.expected_departure) : null,
    expectedArrival: l.realtime === true ? instant(l.expected_arrival) : null,
    realtime: l.realtime === true,
    arrivalEstimated: l.arrival_estimated === true,
    predictionValidUntil:
      l.realtime === true ? new Date(Date.now() + 30_000).toISOString() : null,
    cancelled: l.cancelled === true,
    tripId: id(l.trip_id),
    line: text(object(l.line).code) || text(object(l.line).name),
    operator: text(object(l.operator).name),
    geometry: geometry(l.geometry),
  };
}
export function createTransportProvider(core: CoreClient) {
  return {
    async tracking(id: string) {
      const r = object(
        await core.request(`/transport/v1/trips/${id}/tracking`, {
          method: "POST",
          body: {},
        }),
      );
      if (r.status !== "available")
        return {
          status: r.status === "unsupported" ? "unsupported" : "disabled",
        };
      const address = text(r.url, 2048),
        ticket = text(r.ticket, 4096),
        expiresAt = instant(r.expires_at);
      if (!/^(wss?:)\/\//.test(address) || !ticket || !expiresAt)
        throw new HttpError(502, "invalid_backend_response");
      return { status: "available", url: address, ticket, expiresAt };
    },
    async cities(country: string) {
      const raw = object(
        await core.request("/transport/v1/cities/search", {
          method: "POST",
          body: {
            q: { state: country },
            limit: 10000,
            page: 1,
            sort: [{ name: 1 }],
          },
        }),
      );
      if (
        !Array.isArray(raw.data) ||
        raw.data.length > 10000 ||
        raw.has_more === true
      )
        throw new HttpError(502, "invalid_backend_response");
      const data = raw.data.map((p) => {
        const row = object(p);
        return {
          id: text(row.id),
          name: text(row.name, 120),
          state: text(row.state, 2),
          sourceMode: text(row.source_mode),
        };
      });
      if (data.some((p) => !p.id || !p.name || p.state !== country))
        throw new HttpError(502, "invalid_backend_response");
      return { data, partial: raw.partial === true };
    },
    async places(
      query: string | null,
      country: string,
      city = "",
      location?: { lat: number; lon: number; observedAt: string },
    ): Promise<{ data: PlaceOption[]; partial: boolean }> {
      const raw = object(
        await core.request("/transport/v1/places/search", {
          method: "POST",
          body: {
            q: {
              ...(query === null ? {} : { name: { $regex: query } }),
              ...(country ? { state: country } : {}),
              ...(city ? { city } : {}),
              ...(location
                ? {
                    latitude: location.lat,
                    longitude: location.lon,
                    observed_at: location.observedAt,
                  }
                : {}),
            },
            limit: 20,
          },
        }),
      );
      if (!Array.isArray(raw.data))
        throw new HttpError(502, "invalid_backend_response");
      // No participating source is different from a successful empty search.
      if (!raw.data.length && Array.isArray(raw.sources) && !raw.sources.length)
        throw new HttpError(503, "places_not_configured");
      return {
        data: raw.data
          .slice(0, 20)
          .map((p) => {
            const s = stop(p);
            return {
              ...s,
              id: s.id ?? "",
              sourceMode: text(object(p).source_mode),
              city: text(object(p).city, 120) || null,
            };
          })
          .filter((p) => p.id && p.name),
        partial: raw.partial === true,
      };
    },
    async search(body: Record<string, unknown>) {
      const raw = object(
        await core.request("/transport/v1/journeys/search", {
          method: "POST",
          // Backend may resolve two stops, query live sources, then try fallback.
          timeoutMs: 25_000,
          body,
        }),
      );
      if (!Array.isArray(raw.journeys))
        throw new HttpError(502, "invalid_backend_response");
      const journeys: Journey[] = raw.journeys.slice(0, 20).map((value) => {
        const j = object(value),
          source = object(j.source);
        if (!Array.isArray(j.legs) || !j.legs.length || j.legs.length > 30)
          throw new HttpError(502, "invalid_backend_response");
        const legs = j.legs.map(leg);
        return {
          key: createHash("sha256")
            .update(
              JSON.stringify(
                legs.map((l) => [
                  l.tripId,
                  l.mode,
                  l.scheduledDeparture,
                  l.scheduledArrival,
                  l.from.id,
                  l.to.id,
                ]),
              ),
            )
            .digest("hex")
            .slice(0, 24),
          duration: Math.max(0, Number(j.duration_seconds) || 0),
          transfers: Math.max(0, Number(j.transfers) || 0),
          legs,
          source: {
            provider: text(source.provider, 64),
            mode: text(source.mode, 20),
            limited: source.limited === true,
            attribution: text(source.attribution, 300),
          },
        };
      });
      const resolvedPlaces: SearchResult["resolvedPlaces"] = {};
      for (const side of ["from", "to"] as const) {
        const rawPlace = object(object(raw.resolved_places)[side]);
        const mapped = stop(rawPlace);
        if (mapped.id && mapped.name)
          resolvedPlaces[side] = {
            ...mapped,
            sourceMode: text(rawPlace.source_mode, 20),
          };
      }
      return {
        journeys,
        partial: raw.partial === true,
        resolvedPlaces,
        city: text(object(raw.area).city, 120) || null,
        intercity: object(raw.area).intercity === true,
      };
    },
    async stop(stopId: string): Promise<Stop> {
      const raw = object(await core.request(`/transport/v1/stops/${stopId}`));
      const mapped = stop(raw.result);
      if (!mapped.id || !mapped.name)
        throw new HttpError(502, "invalid_backend_response");
      return mapped;
    },
    async trip(tripId: string): Promise<Trip> {
      const raw = object(await core.request(`/transport/v1/trips/${tripId}`)),
        trip = object(raw.result);
      if (!Array.isArray(trip.stops))
        throw new HttpError(502, "invalid_backend_response");
      return {
        sourceMode: text(object(raw.source).mode),
        metadata: tripMetadata(trip.metadata, trip.operator),
        stops: trip.stops.slice(0, 500).map((value) => {
          const call = object(value);
          return {
            stop: stop(call.stop),
            arrival: instant(call.scheduled_arrival),
            departure: instant(call.scheduled_departure),
            tariffZones: (Array.isArray(call.tariff_zones)
              ? call.tariff_zones
              : []
            )
              .slice(0, 30)
              .map((value) => {
                const z = object(value);
                return {
                  system: text(z.system, 80) || null,
                  zone: text(z.zone, 80),
                };
              })
              .filter((z) => z.zone),
            requestStop:
              typeof call.request_stop === "boolean" ? call.request_stop : null,
            routeKm:
              typeof call.route_km === "number" &&
              Number.isFinite(call.route_km) &&
              call.route_km >= 0
                ? call.route_km
                : null,
          };
        }),
      };
    },
  };
}
