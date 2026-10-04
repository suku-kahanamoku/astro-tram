import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StopLabel from "../src/modules/TransportJourneyModule/components/StopLabel";
import { dictionary } from "../src/modules/TransportCoreModule/providers/translations";
import type { Stop } from "../src/modules/TransportCoreModule/types";

const stop: Stop = {
  id: null,
  name: "Zastávka <A>",
  lat: null,
  lon: null,
  platform: "<1>",
};

test("shared stop labels only link mappable stops, including coordinates at zero, and preserve the caller's map target", () => {
  for (const [value, linked] of [
    [stop, false],
    [{ ...stop, id: "stop-id" }, true],
    [{ ...stop, lat: 0, lon: 0 }, true],
    [{ ...stop, lat: 0 }, false],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(StopLabel, {
        stop: value,
        t: dictionary("cs"),
        href: "/spojeni/?map=stop&tripStop=7",
        linkAttributes: { "data-trip-stop-map": 7 },
      }),
    );
    assert.equal(html.includes("<a "), linked);
    if (linked) {
      assert.match(html, /href="\/spojeni\/\?map=stop&amp;tripStop=7"/);
      assert.match(html, /data-trip-stop-map="7"/);
      assert.match(html, /aria-haspopup="dialog"/);
    }
    assert.match(html, /Zastávka &lt;A&gt;/);
    assert.match(html, /&lt;1&gt;/);
    assert.doesNotMatch(html, /<A>|<1>/);
  }
});

test("request-stop and platform metadata use the current locale and no empty markers are invented", () => {
  for (const locale of ["cs", "en", "de"] as const) {
    const t = dictionary(locale);
    const html = renderToStaticMarkup(
      createElement(StopLabel, { stop, t, requestStop: true }),
    );
    assert.ok(html.includes(`title="${t.requestStop}"`));
    assert.ok(html.includes(`aria-label="${t.requestStop}"`));
    assert.ok(html.includes(`· ${t.platform} &lt;1&gt;`));
    const plain = renderToStaticMarkup(
      createElement(StopLabel, { stop: { ...stop, platform: null }, t }),
    );
    assert.equal(plain, "Zastávka &lt;A&gt;");
  }
});
