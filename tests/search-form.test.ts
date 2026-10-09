import test from "node:test";
import assert from "node:assert/strict";
import {
  searchDraft,
  editorFields,
  submissionInstant,
} from "../src/modules/TransportSearchModule/providers/searchDefaults";
import {
  readState,
  writeState,
  localFields,
  searchBody,
} from "../src/modules/TransportCoreModule/providers/state";

test("unselected names survive navigation and never become backend place identities", () => {
  const draft = searchDraft(
    new URLSearchParams(
      "fromText=Brno&toText=Letovice&country=CZ&at=2026-10-09T08:00:00Z",
    ),
  );
  assert.equal(draft.from, undefined);
  assert.equal(draft.fromText, "Brno");
  assert.equal(draft.toText, "Letovice");
  const replay = readState(writeState(draft));
  assert.equal(replay.fromText, "Brno");
  assert.equal(replay.toText, "Letovice");
  assert.throws(() => searchBody(replay), /invalid/);
  const resolved = {
    ...draft,
    from: { type: "stop" as const, id: "resolved", label: "Brno" },
  };
  assert.equal(writeState(resolved).has("fromText"), false);
  assert.equal(
    readState(new URLSearchParams("from=resolved&fromText=ignored")).fromText,
    undefined,
  );
  assert.equal(
    readState(
      new URLSearchParams({ fromText: " ".repeat(5) + "a".repeat(180) }),
    ).fromText?.length,
    160,
  );
});

test("editor defaults to current location and automatic clock without changing a replayed search", () => {
  const state = searchDraft(new URLSearchParams());
  assert.equal(state.from?.type, "current_location");
  assert.equal(state.to, undefined);
  assert.equal(state.areaMode, undefined);
  assert.equal(state.timeMode, "now");
  assert.equal(readState(new URLSearchParams()).from, undefined);
  assert.equal(
    searchDraft(new URLSearchParams("country=SK")).areaMode,
    undefined,
  );
});
test("automatic editor fields refresh without changing the saved search instant", () => {
  const state = searchDraft(
    new URLSearchParams(
      "at=2026-10-06T21%3A59%3A49Z&dayMode=today&timeMode=now",
    ),
  );
  const now = new Date("2026-10-07T10:15:39Z");
  assert.deepEqual(editorFields(state, now), localFields(now));
  assert.equal(state.at, "2026-10-06T21:59:49Z");
  assert.equal(
    editorFields({ ...state, timeMode: undefined }, now).time,
    localFields(new Date(state.at!)).time,
  );
});
test("each submission samples now, including seconds and a midnight rollover", () => {
  const draft = searchDraft(new URLSearchParams());
  const old = localFields(new Date("2026-10-06T21:50:00Z"));
  for (const instant of ["2026-10-06T21:59:49Z", "2026-10-07T01:03:27Z"])
    assert.equal(submissionInstant(draft, old, new Date(instant)), instant);
});
test("editing date and time independently freezes only the edited part and survives URL reload", () => {
  const now = new Date("2026-10-07T10:15:39Z"),
    auto = searchDraft(new URLSearchParams());
  const fields = { day: "2026-11-05", time: "08:45" };
  const fixedDay = { ...auto, dayMode: undefined };
  assert.deepEqual(
    localFields(new Date(submissionInstant(fixedDay, fields, now))),
    { day: fields.day, time: localFields(now).time },
  );
  const fixedTime = { ...auto, timeMode: undefined };
  assert.deepEqual(
    localFields(new Date(submissionInstant(fixedTime, fields, now))),
    { day: localFields(now).day, time: fields.time },
  );
  const state = { ...fixedTime, at: submissionInstant(fixedTime, fields, now) };
  assert.equal(readState(writeState(state)).dayMode, "today");
  assert.equal(readState(writeState(state)).timeMode, undefined);
  assert.throws(() =>
    submissionInstant(
      { ...auto, dayMode: undefined, timeMode: undefined },
      { day: "2026-02-30", time: "10:00" },
    ),
  );
});
