import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import {
  createOnlinePlannerProvider,
  projectOnlinePlanners,
} from "../src/modules/SiteModule/server/onlinePlannerProvider";
import { isPublicTransportRead } from "../src/modules/TransportModule/server/requestPolicy";
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
    await createOnlinePlannerProvider(core).setOnlinePlanners(
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
