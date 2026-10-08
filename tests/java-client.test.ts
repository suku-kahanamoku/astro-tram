import test from "node:test";
import assert from "node:assert/strict";
import { createJavaTramClient } from "../src/modules/CoreModule/server/java-tram";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
const config = {
  baseUrl: "https://java.example.test",
  serviceToken: "synthetic-java-service-token-only",
};
test("transport uses Java Bearer directly without PHP tenant/application headers", async () => {
  let calls = 0;
  const java = createJavaTramClient(config, async (input, init) => {
    calls++;
    assert.equal(input, "https://java.example.test/transport/v1/coverage");
    const h = new Headers(init?.headers);
    assert.equal(h.get("Authorization"), "Bearer " + config.serviceToken);
    assert.equal(h.get("X-Internal-Key"), null);
    assert.equal(h.get("X-Forwarded-Host"), null);
    assert.equal(init?.redirect, "error");
    return Response.json({
      success: true,
      data: {
        countries: [
          {
            state: "CZ",
            capabilities: ["search"],
            search_available: true,
            cities_available: true,
          },
        ],
      },
    });
  });
  assert.equal((await createTransportProvider(java).coverage())[0].state, "CZ");
  for (const path of [
    "/auth/me",
    "/admin/online-planners",
    "/transport-admin/online-planners",
    "//other",
  ])
    await assert.rejects(java.request(path), { code: "invalid_backend_path" });
  await assert.rejects(
    java.request("/transport/v1/coverage", { token: "user-bearer" }),
    { code: "invalid_backend_credentials" },
  );
  assert.equal(calls, 1);
});
test("unconfigured Java transport fails closed instead of falling back to PHP", async () => {
  const java = createJavaTramClient(
    { ...config, serviceToken: "" },
    async () => {
      throw Error("unexpected network");
    },
  );
  await assert.rejects(java.request("/transport/v1/coverage"), {
    status: 503,
    code: "backend_not_configured",
  });
});
