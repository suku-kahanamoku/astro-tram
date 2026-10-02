import test from "node:test";
import assert from "node:assert/strict";
import { isPublicTransportRead } from "../src/modules/TransportModule/server/requestPolicy";

test("origin exception covers only explicit read-only transport POST routes", () => {
  for (const path of ["places", "search"])
    assert.equal(
      isPublicTransportRead(
        new Request(`https://tram.test/api/transport/${path}/`, {
          method: "POST",
        }),
      ),
      true,
    );
  for (const path of [
    "/api/auth/login/",
    "/api/auth/logout/",
    "/api/transport/tracking/",
    "/api/transport/search/other/",
  ])
    assert.equal(
      isPublicTransportRead(
        new Request(`https://tram.test${path}`, { method: "POST" }),
      ),
      false,
    );
  assert.equal(
    isPublicTransportRead(
      new Request("https://tram.test/api/transport/search/", {
        method: "DELETE",
      }),
    ),
    false,
  );
});
