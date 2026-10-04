// Isolated browser-test provider. Never imported by the application.
import http from "node:http";
import { randomBytes } from "node:crypto";
const encode = (kind, id, date = null) =>
  Buffer.from(JSON.stringify(["tram", "pid", kind, id, date])).toString(
    "base64url",
  );
const names = ["Praha, Muzeum", "Praha, Malostranská", "Praha, Národní třída"];
const stops = names.map((name, i) => ({
  id: encode("stop", `S${i + 1}`),
  name,
  lat: 50.075 + i * 0.005,
  lon: 14.43 - i * 0.009,
  platform: String(i + 1),
  source_mode: "live",
  city: "Praha",
}));
const brnoStop = {
  ...stops[0],
  id: encode("stop", "S4"),
  name: "Brno, Grohova",
  city: "Brno",
};
const shift = (at, min) =>
  new Date(Date.parse(at) + min * 60000).toISOString().replace(".000Z", "Z");
const pipelineJobs = new Map();
http
  .createServer(async (req, res) => {
    const send = (status, data, code) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: status >= 200 && status < 300,
          data,
          ...(code
            ? { errors: { code }, message: "INTERNAL_PRIVATE_TOKEN" }
            : {}),
        }),
      );
    };
    const url = new URL(req.url, "http://mock.test");
    if (url.pathname === "/health") return send(200, null);
    if (
      req.headers["x-internal-key"] !== "test-only-secret" ||
      req.headers["x-forwarded-host"] !== "tram.test"
    )
      return send(403, null);
    let body = "";
    for await (const chunk of req) body += chunk;
    const bearer = req.headers.authorization;
    const admin = bearer === `Bearer ${"a".repeat(64)}`;
    const authenticated = admin || bearer === `Bearer ${"b".repeat(64)}`;
    const user = {
      id: 1,
      email: admin ? "admin@example.test" : "user@example.test",
      first_name: "Test",
      last_name: "User",
      role: admin ? "admin" : "user",
    };
    if (url.pathname === "/auth/login") {
      const data = JSON.parse(body);
      if (
        data.password !== "fixture-password" ||
        !["admin@example.test", "user@example.test"].includes(data.email)
      )
        return send(401, null);
      const isAdmin = data.email === "admin@example.test";
      return send(200, {
        ...user,
        email: data.email,
        role: isAdmin ? "admin" : "user",
        token: (isAdmin ? "a" : "b").repeat(64),
      });
    }
    if (url.pathname === "/auth/me")
      return send(authenticated ? 200 : 401, user);
    if (url.pathname === "/auth/logout")
      return send(authenticated ? 200 : 401, null);
    if (url.pathname === "/transport-admin/local-pipeline") {
      if (!authenticated) return send(401, null);
      if (!admin) return send(403, null);
      if (req.method === "GET") {
        const job = pipelineJobs.get(bearer);
        return send(200, {
          ...(job
            ? {
                ...job,
                status: Date.now() - job.at > 1000 ? "ready" : "queued",
              }
            : { status: "idle" }),
          runner: { online: true },
        });
      }
      const action = JSON.parse(body).action;
      if (!["sync_build", "deploy"].includes(action)) return send(422, null);
      const job = {
        id: "00000000-0000-0000-0000-000000000001",
        action,
        status: "queued",
        at: Date.now(),
      };
      pipelineJobs.set(bearer, job);
      return send(202, job);
    }
    if (url.pathname === "/transport/v1/attributions")
      return send(200, [
        {
          id: "fixture-timetable",
          feed_id: "fixture",
          name: "Testovací jízdní řád",
          attribution: "Syntetická data pro testování TRAM.",
          license_url: "https://example.test/timetable-license",
          source_url: "https://example.test/timetable",
          published_at: "2026-10-01T12:00:00Z",
          updated_at: "2026-10-03T08:00:00Z",
          requirements: ["Tato data nejsou skutečný jízdní řád."],
          private_token: "DO_NOT_EXPOSE",
        },
        {
          id: "fixture-osm",
          feed_id: null,
          name: "OpenStreetMap",
          attribution: "© OpenStreetMap contributors",
          license_url: "https://opendatacommons.org/licenses/odbl/1-0/",
          source_url: "https://www.openstreetmap.org/copyright",
          published_at: null,
          updated_at: null,
          requirements: [],
        },
      ]);
    if (url.pathname === "/transport/v1/coverage")
      return send(200, {
        providers: [],
        countries: [
          {
            state: "CZ",
            capabilities: ["places", "journeys", "cities"],
            search_available: true,
            cities_available: true,
          },
          {
            state: "AT",
            capabilities: ["stop", "departures"],
            search_available: false,
            cities_available: false,
          },
        ],
      });
    if (url.pathname === "/transport/v1/cities/search") {
      const query = JSON.parse(body);
      const names =
        query.q.state === "CZ"
          ? [
              "Brno",
              "České Budějovice",
              "Liberec",
              "Ostrava",
              "Plzeň",
              "Praha",
              "Tábor",
              "Třebíč",
            ]
          : [];
      return send(200, {
        data: names.map((name, i) => ({
          id: encode("city", String(i)),
          name,
          state: query.q.state,
          source_mode: "live",
        })),
        partial: false,
        has_more: false,
        total: names.length,
      });
    }
    if (url.pathname === "/transport/v1/places/search") {
      const query = JSON.parse(body).q;
      if (!query.name) return send(200, { data: stops, partial: false });
      const q = (query.name.$regex ?? "").toLowerCase();
      return send(200, {
        data: [...stops, brnoStop].filter((s) =>
          s.name.toLowerCase().includes(q),
        ),
        partial: false,
      });
    }
    if (url.pathname === "/transport/v1/journeys/search") {
      const input = JSON.parse(body);
      if (input.state === "US") return send(422, null, "unsupported_coverage");
      if (input.state === "DE") return send(503, null, "sources_unavailable");
      if (input.state === "FR")
        return send(200, { journeys: [], partial: false });
      const from = input["from-dest"],
        to = input["to-dest"];
      for (const place of [from, to])
        if (
          place.type === "current_location" &&
          (Date.now() - Date.parse(place["observed-at"]) > 30000 ||
            !Number.isFinite(place.lat))
        )
          return send(422, null, "stale_location");
      const at = input["from-date"] ?? shift(input["to-date"], -15);
      const start =
        from.type === "stop"
          ? ([...stops, brnoStop].find((s) => s.id === from.id) ?? stops[0])
          : { id: null, name: "Current start", lat: from.lat, lon: from.lon };
      const end =
        to.type === "stop"
          ? ([...stops, brnoStop].find((s) => s.id === to.id) ?? stops[1])
          : { id: null, name: "Map destination", lat: to.lat, lon: to.lon };
      const leg = (a, b, departure, arrival, code) => ({
        mode: "tram",
        from: a,
        to: b,
        scheduled_departure: departure,
        scheduled_arrival: arrival,
        expected_departure: departure,
        expected_arrival: arrival,
        realtime: true,
        cancelled: false,
        trip_id: encode("trip", code, at.slice(0, 10)),
        line: { code: "22", name: "22" },
        operator: { name: "Dopravní podnik" },
        geometry: {
          type: "LineString",
          coordinates: [
            [a.lon, a.lat],
            [b.lon, b.lat],
          ],
        },
        private_secret: "DO_NOT_EXPOSE",
        vehicle_position: { lat: 50, lon: 14 },
      });
      const journeys = [
        {
          id: randomBytes(16).toString("hex"),
          duration_seconds: 900,
          transfers: 0,
          legs: [leg(start, end, at, shift(at, 15), "T1")],
          source: {
            provider: "pid",
            mode: "live",
            attribution: "PID / Golemio",
            limited: true,
            secret: "DO_NOT_EXPOSE",
          },
        },
      ];
      if (input["max-transfers"] !== 0)
        journeys.push({
          id: randomBytes(16).toString("hex"),
          duration_seconds: 1800,
          transfers: 1,
          legs: [
            leg(start, stops[2], shift(at, 5), shift(at, 15), "T2"),
            leg(stops[2], end, shift(at, 20), shift(at, 35), "T3"),
          ],
          source: {
            provider: "pid-otp",
            mode: "fallback",
            attribution: "PID",
            limited: false,
          },
        });
      return send(200, {
        journeys,
        area: {
          city: start.city && start.city === end.city ? start.city : null,
          intercity: !!start.city && !!end.city && start.city !== end.city,
        },
        partial: true,
        resolved_places: {
          ...(input["from-dest"].type === "current_location"
            ? {
                from: {
                  ...stops[0],
                  name:
                    input["from-dest"].lat > 50.085
                      ? "Praha, Vltavská"
                      : "Praha, Muzeum",
                },
              }
            : {}),
          ...(input["to-dest"].type === "current_location"
            ? { to: stops[1] }
            : {}),
        },
      });
    }
    if (url.pathname.startsWith("/transport/v1/stops/")) {
      const id = url.pathname.split("/").at(-1);
      const stop = [...stops, brnoStop].find((s) => s.id === id);
      return stop
        ? send(200, {
            result: { ...stop, internal_key: "DO_NOT_EXPOSE" },
            source: { mode: "live" },
          })
        : send(404, null);
    }
    if (url.pathname.endsWith("/observation"))
      return send(200, {
        status: "unavailable",
        position: null,
        observed_at: null,
        valid_until: null,
        delay_seconds: null,
        cancelled: null,
      });
    if (url.pathname.startsWith("/transport/v1/trips/"))
      return send(200, {
        result: {
          metadata: {
            line: "22",
            number: "1093",
            service_date: "2026-10-06",
            operator: {
              name: "Testovací dopravce",
              city: "Praha",
              url: "https://example.test/operator",
              phone: "+420 123 456 789",
              private_token: "DO_NOT_EXPOSE",
            },
            notes: [
              {
                scope: "trip",
                default_language: "cs",
                texts: {
                  cs: "Garantovaná návaznost dle testovacího jízdního řádu.",
                  en: "Test timetable connection.",
                },
              },
              {
                scope: "line",
                default_language: "cs",
                texts: { cs: "Tarif: www.example.test/tarif" },
              },
            ],
            vehicle_position: { lat: 50, lon: 14 },
          },
          stops: stops.map((stop, i) => ({
            stop,
            tariff_zones: [{ system: "PID", zone: "P" }],
            request_stop: i === 1,
            route_km: [0, 0.303, 1.227][i],
            scheduled_arrival: `2026-10-06T10:${String(i * 5).padStart(2, "0")}:00+02:00`,
            scheduled_departure: `2026-10-06T10:${String(i * 5).padStart(2, "0")}:00+02:00`,
          })),
        },
        source: { mode: "live" },
      });
    return send(404, null);
  })
  .listen(4399, "127.0.0.1");
