import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import {
  HttpError,
  errorResponse,
} from "../src/modules/CoreModule/server/errors";
import { createAuthProvider } from "../src/modules/AuthModule/server/provider";
import {
  assertSameOrigin,
  requestOrigin,
  readFields,
} from "../src/modules/CoreModule/server/request";

const config = {
  baseUrl: "https://core.example.test/api",
  apiKey: "server-secret",
  tenantHost: "scaffold.localhost",
};
const user = {
  id: 1,
  email: "user@example.test",
  first_name: "Test",
  last_name: "User",
  role: "user",
};
test("core preserves API prefix, sends fixed tenant and server credentials, rejects redirects", async () => {
  const fetcher: typeof fetch = async (input, options) => {
    assert.equal(input, "https://core.example.test/api/auth/me");
    const headers = new Headers(options?.headers);
    assert.equal(headers.get("X-Internal-Key"), "server-secret");
    assert.equal(headers.get("X-Forwarded-Host"), "scaffold.localhost");
    assert.equal(headers.get("Authorization"), "Bearer token");
    assert.equal(options?.redirect, "error");
    assert.equal(options?.cache, "no-store");
    return Response.json({ success: true, data: user });
  };
  assert.deepEqual(
    await createCoreClient(config, fetcher).request("/auth/me", {
      token: "token",
    }),
    user,
  );
});
test("login maps real php-core envelope and never exposes token in public user", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({
      success: true,
      data: {
        ...user,
        token: "a".repeat(64),
        expires_at: "2026-10-01 10:00:00",
        password: "secret",
      },
    });
  const result = await createAuthProvider(
    createCoreClient(config, fetcher),
  ).login(user.email, "password");
  assert.deepEqual(result.user, user);
  assert.equal(result.token, "a".repeat(64));
});
test("malformed login token is rejected", async () => {
  const fetcher: typeof fetch = async () =>
    Response.json({ success: true, data: { ...user, token: "invalid" } });
  await assert.rejects(
    createAuthProvider(createCoreClient(config, fetcher)).login(
      user.email,
      "password",
    ),
    { status: 502 },
  );
});
test("unsafe paths and missing config fail before fetch", async () => {
  const fetcher: typeof fetch = async () => {
    assert.fail("Must not fetch");
  };
  for (const path of [
    "https://evil.test/",
    "//evil.test/",
    "/../users",
    "/auth/me?token=x",
    "/auth\\me",
  ])
    await assert.rejects(
      createCoreClient(config, fetcher).request(path),
      HttpError,
    );
  await assert.rejects(
    createCoreClient({ ...config, apiKey: "" }, fetcher).request("/auth/me"),
    { status: 503 },
  );
});
test("upstream errors and invalid JSON never leak upstream content", async () => {
  for (const response of [
    new Response("private stack server-secret", { status: 500 }),
    new Response("invalid json"),
    Response.json({ success: false, message: "server-secret" }),
  ]) {
    const fetcher: typeof fetch = async () => response;
    try {
      await createCoreClient(config, fetcher).request("/auth/me");
      assert.fail("Expected error");
    } catch (error) {
      const result = errorResponse(error);
      assert.equal(result.status, 502);
      assert.doesNotMatch(await result.text(), /server-secret|private stack/);
    }
  }
});
test("network timeout and unauthorized are distinguishable", async () => {
  const unavailable: typeof fetch = async () => {
    throw new Error("sensitive URL");
  };
  await assert.rejects(
    createCoreClient(config, unavailable).request("/auth/me"),
    { status: 502, code: "backend_unavailable" },
  );
  await assert.rejects(
    createCoreClient(
      config,
      async () => new Response(null, { status: 401 }),
    ).request("/auth/me"),
    { status: 401 },
  );
});
test("development uses the running port while production keeps its configured origin", () => {
  const requestUrl = new URL("http://localhost:4322/api/transport/places/");
  const site = new URL("https://tram.example.test");
  assert.equal(requestOrigin(requestUrl, site, true), "http://localhost:4322");
  assert.equal(
    requestOrigin(requestUrl, site, false),
    "https://tram.example.test",
  );
  assert.equal(
    requestOrigin(requestUrl, undefined, false),
    "http://localhost:4322",
  );
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request(requestUrl, {
        method: "POST",
        headers: { Origin: "http://localhost:4322" },
      }),
      requestOrigin(requestUrl, site, true),
    ),
  );
  assert.throws(
    () =>
      assertSameOrigin(
        new Request(requestUrl, {
          method: "POST",
          headers: { Origin: "http://localhost:4322" },
        }),
        requestOrigin(requestUrl, site, false),
      ),
    { status: 403 },
  );
});
test("state changes reject missing and foreign origins including cross-site metadata", () => {
  for (const headers of [
    {},
    { origin: "https://evil.test" },
    { origin: "https://site.test", "sec-fetch-site": "cross-site" },
  ] as Record<string, string>[])
    assert.throws(
      () =>
        assertSameOrigin(
          new Request("https://site.test/api/auth/login/", {
            method: "POST",
            headers,
          }),
          "https://site.test",
        ),
      { status: 403 },
    );
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request("https://site.test/api/auth/login/", {
        method: "POST",
        headers: { origin: "https://site.test" },
      }),
      "https://site.test",
    ),
  );
});
test("body parser accepts JSON and forms but rejects malformed, unsupported and oversized bodies", async () => {
  const request = (body: string, type = "application/json") =>
    new Request("https://site.test", {
      method: "POST",
      headers: { "Content-Type": type },
      body,
    });
  assert.deepEqual(await readFields(request('{"email":"a@b.cz"}')), {
    email: "a@b.cz",
  });
  assert.deepEqual(
    await readFields(
      request("locale=de&email=a%40b.cz", "application/x-www-form-urlencoded"),
    ),
    { locale: "de", email: "a@b.cz" },
  );
  await assert.rejects(readFields(request("[]")), { status: 422 });
  await assert.rejects(readFields(request("nope")), { status: 422 });
  await assert.rejects(readFields(request("{}", "text/plain")), {
    status: 415,
  });
  await assert.rejects(readFields(request("x".repeat(20_000))), {
    status: 413,
  });
});

test("BFF preserves Retry-After on rate limits without exposing upstream messages", async () => {
  const core = createCoreClient(config, async () =>
    Response.json(
      { error: "private upstream diagnostic" },
      { status: 429, headers: { "Retry-After": "17" } },
    ),
  );
  let failure: unknown;
  try {
    await core.request("/transport/v1/trips/example/tracking", {
      method: "POST",
      body: {},
    });
  } catch (error) {
    failure = error;
  }
  const response = errorResponse(failure);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "17");
  assert.deepEqual(await response.json(), {
    success: false,
    error: "rate_limited",
  });
});

test("BFF preserves a stale stop snapshot as 409 and never publishes a journey", async () => {
  let calls = 0;
  const core = createCoreClient(config, async () => {
    calls++;
    return Response.json(
      {
        success: false,
        error: "stale_resource",
        errors: { code: "stale_resource" },
        message: "private diagnostic",
      },
      { status: 409 },
    );
  });
  let failure: unknown;
  try {
    await core.request("/transport/v1/journeys/search", {
      method: "POST",
      body: {},
    });
  } catch (error) {
    failure = error;
  }
  const response = errorResponse(failure);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    success: false,
    error: "stale_resource",
  });
  assert.equal(
    calls,
    1,
    "A snapshot conflict must never be retried as an upstream outage",
  );
});
