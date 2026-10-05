import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import {
  createPipelineProvider,
  projectPipeline,
  projectOnlinePlanners,
} from "../src/modules/SiteModule/server/pipelineProvider";
import { isPublicTransportRead } from "../src/modules/TransportModule/server/requestPolicy";

const queued = {
  status: "queued",
  action: "sync_build",
  id: "00000000-0000-0000-0000-000000000001",
};
test("pipeline projects the real POST receipt without runner metadata and filters private fields", () => {
  assert.deepEqual(
    projectPipeline({ ...queued, lease: "secret", expires: 123 }, false),
    { ...queued, runner: null },
  );
  assert.deepEqual(
    projectPipeline({
      status: "idle",
      runner: { online: true, last_seen: 123 },
      token: "secret",
    }),
    {
      status: "idle",
      runner: { online: true },
    },
  );
  for (const value of [
    null,
    [],
    {},
    queued,
    { ...queued, action: ["sync_build"], runner: { online: true } },
  ])
    assert.throws(() => projectPipeline(value), { status: 502 });
});
test("online policy is a boolean-only projection and uses a protected fixed admin route", async () => {
  assert.deepEqual(
    projectOnlinePlanners({ enabled: false, token: "private" }),
    { enabled: false },
  );
  for (const value of [null, [], {}, { enabled: "false" }])
    assert.throws(() => projectOnlinePlanners(value), { status: 502 });
  const core = createCoreClient(
    {
      baseUrl: "https://core.test/api",
      apiKey: "private",
      tenantHost: "tram.test",
    },
    async (input, init) => {
      assert.equal(
        input,
        "https://core.test/api/transport-admin/online-planners",
      );
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer session-token",
      );
      assert.equal(init?.body, JSON.stringify({ enabled: false }));
      return Response.json({
        success: true,
        data: { enabled: false, token: "must-be-filtered" },
      });
    },
  );
  assert.deepEqual(
    await createPipelineProvider(core).setOnlinePlanners(
      false,
      "session-token",
    ),
    { enabled: false },
  );
  assert.equal(
    isPublicTransportRead(
      new Request("https://tram.test/api/admin/online-planners/", {
        method: "POST",
      }),
    ),
    false,
  );
});
test("pipeline sends only a fixed PHP path, session bearer and explicit action", async () => {
  const core = createCoreClient(
    {
      baseUrl: "https://core.test/api",
      apiKey: "private-internal",
      tenantHost: "tram.test",
    },
    async (input, init) => {
      assert.equal(
        input,
        "https://core.test/api/transport-admin/local-pipeline",
      );
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), "Bearer session-token");
      assert.equal(headers.get("X-Internal-Key"), "private-internal");
      assert.equal(init?.body, JSON.stringify({ action: "sync_build" }));
      return Response.json({ success: true, data: queued }, { status: 202 });
    },
  );
  assert.equal(
    (await createPipelineProvider(core).submit("sync_build", "session-token"))
      .status,
    "queued",
  );
  assert.equal(
    isPublicTransportRead(
      new Request("https://tram.test/api/admin/local-pipeline/", {
        method: "POST",
      }),
    ),
    false,
  );
});
