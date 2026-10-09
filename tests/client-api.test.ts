import test from "node:test";
import assert from "node:assert/strict";
import {
  api,
  ApiError,
  requestJson,
} from "../src/modules/CoreModule/providers/api";

test("browser API preserves cookies, bypasses HTTP caches, and sends JSON headers only with a body", async () => {
  const original = globalThis.fetch;
  const calls: RequestInit[] = [];
  globalThis.fetch = async (_path, init) => {
    calls.push(init!);
    return Response.json({ success: true, data: null });
  };
  try {
    assert.equal(await api("/api/auth/me/"), null);
    await api("/api/auth/login/", { method: "POST", body: { email: "user" } });
    assert.equal(calls[0].cache, "no-store");
    assert.equal(calls[0].credentials, "same-origin");
    assert.equal(new Headers(calls[0].headers).get("Content-Type"), null);
    assert.equal(
      new Headers(calls[1].headers).get("Content-Type"),
      "application/json",
    );
    assert.equal(calls[1].body, '{"email":"user"}');
    await assert.rejects(
      requestJson("https://external.test/api/x"),
      /Invalid API path/,
    );
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("HTML errors, malformed success envelopes and Retry-After produce stable API errors", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<h1>Unavailable</h1>", { status: 503 });
    await assert.rejects(
      api("/api/auth/me/"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 503 &&
        error.code === "request_failed",
    );
    globalThis.fetch = async () => Response.json({ success: true });
    await assert.rejects(api("/api/auth/me/"), ApiError);
    globalThis.fetch = async () =>
      Response.json(
        { success: false, error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "3" } },
      );
    await assert.rejects(
      api("/api/auth/me/"),
      (error: unknown) =>
        error instanceof ApiError && error.retryAfterMs === 3000,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("unmount cancellation reaches the shared browser API transport", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let received: AbortSignal | undefined;
  globalThis.fetch = async (_url, options) => {
    received = options?.signal ?? undefined;
    return new Promise((_, reject) =>
      received!.addEventListener("abort", () => reject(received!.reason), {
        once: true,
      }),
    );
  };
  try {
    const pending = api("/api/auth/me/", { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(received?.aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("shared API transport terminates a stalled request within its timeout budget", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) =>
    new Promise((_, reject) =>
      options!.signal!.addEventListener(
        "abort",
        () => reject(options!.signal!.reason),
        { once: true },
      ),
    );
  const guard = setTimeout(() => {}, 200);
  try {
    await assert.rejects(requestJson("/api/auth/me/", {}, 5), {
      name: "TimeoutError",
    });
  } finally {
    clearTimeout(guard);
    globalThis.fetch = original;
  }
});
