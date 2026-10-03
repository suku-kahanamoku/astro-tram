import test from "node:test";
import assert from "node:assert/strict";
import { createCoreClient } from "../src/modules/CoreModule/server/php-core";
import { createTransportProvider } from "../src/modules/TransportModule/server/provider";
import {
  projectAttributions,
  publicAttributionUrl,
} from "../src/modules/TransportCoreModule/providers/attributions";

const credit = {
  id: "active-feed",
  feed_id: "pid",
  name: "Published timetable",
  attribution: "Credit required by the actual source",
  license_url: "https://example.test/licence",
  source_url: "https://example.test/data",
  published_at: "2026-10-01T08:00:00Z",
  updated_at: "2026-10-03T08:00:00.123Z",
  requirements: ["Preserve the provider's required note."],
};

test("attribution BFF reads only the fixed tenant endpoint and projects public source credits", async () => {
  const provider = createTransportProvider(
    createCoreClient(
      {
        baseUrl: "https://core.test/api",
        apiKey: "PRIVATE_API_KEY",
        tenantHost: "tram.test",
      },
      async (url, options) => {
        assert.equal(
          new URL(String(url)).pathname,
          "/api/transport/v1/attributions",
        );
        assert.equal(
          new Headers(options?.headers).get("X-Internal-Key"),
          "PRIVATE_API_KEY",
        );
        assert.equal(
          new Headers(options?.headers).get("X-Forwarded-Host"),
          "tram.test",
        );
        assert.equal(options?.method, "GET");
        return Response.json({
          success: true,
          data: [
            {
              ...credit,
              private_key: "DO_NOT_EXPOSE",
              download_url: "http://internal/data?token=DO_NOT_EXPOSE",
            },
          ],
        });
      },
    ),
  );
  const result = await provider.attributions();
  assert.deepEqual(result, [credit]);
  assert.doesNotMatch(
    JSON.stringify(result),
    /PRIVATE_API_KEY|DO_NOT_EXPOSE|download_url/,
  );
});

test("public attribution links reject internal addresses, embedded credentials and signed download URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,PRIVATE",
    "https://user:password@example.test/data",
    "http://localhost:8082/data",
    "http://service.internal/data",
    "http://127.0.0.1/data",
    "http://2130706433/data",
    "http://10.0.0.1/data",
    "http://169.254.169.254/data",
    "http://172.16.0.1/data",
    "http://192.168.1.1/data",
    "http://100.64.0.1/data",
    "http://[::1]/data",
    "http://[fc00::1]/data",
    "http://[::ffff:127.0.0.1]/data",
    "https://example.test/data?api_key=PRIVATE",
    "https://example.test/data?access_token=PRIVATE",
    "https://example.test/data?X-Amz-Credential=PRIVATE",
    "https://example.test/data?X-Amz-Signature=PRIVATE",
  ])
    assert.equal(publicAttributionUrl(url), null, url);
  assert.equal(
    publicAttributionUrl("https://www.openstreetmap.org/copyright"),
    "https://www.openstreetmap.org/copyright",
  );
  assert.equal(
    publicAttributionUrl("http://example.test/licence?language=cs"),
    "http://example.test/licence?language=cs",
  );
  assert.equal(
    publicAttributionUrl("https://[2606:4700:4700::1111]/licence"),
    "https://[2606:4700:4700::1111]/licence",
  );
  assert.equal(
    projectAttributions([
      { ...credit, source_url: "https://example.test/data?token=PRIVATE" },
    ])[0].source_url,
    null,
  );
});

test("invalid required attribution data fails instead of inventing or truncating credits", () => {
  assert.deepEqual(projectAttributions([]), []);
  for (const input of [
    null,
    [credit, credit],
    [{ ...credit, attribution: "" }],
    [{ ...credit, license_url: "http://localhost/license" }],
    [{ ...credit, requirements: [42] }],
    [{ ...credit, updated_at: "not-a-date" }],
  ])
    assert.throws(() => projectAttributions(input), /invalid_attributions/);
});
