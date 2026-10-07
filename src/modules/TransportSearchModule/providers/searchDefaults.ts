import {
  formInstant,
  localFields,
  readState,
} from "../../TransportCoreModule/providers/state";
import type { SearchState } from "../../TransportCoreModule/types";

/** Defaults apply to the editor, not to replaying a saved search. */
export function searchDraft(params: URLSearchParams): SearchState {
  const state = readState(params);
  return {
    ...state,
    from: state.from ?? { type: "current_location", label: "" },
    ...(!state.at ? ({ dayMode: "today", timeMode: "now" } as const) : {}),
    ...(!state.country ? ({ areaMode: "gps" } as const) : {}),
  };
}

/** The saved search keeps its snapshot; automatic editor fields still show today/now. */
export function editorFields(state: SearchState, now = new Date()) {
  const saved = localFields(state.at ? new Date(state.at) : now);
  const current = localFields(now);
  return {
    day: state.dayMode === "today" ? current.day : saved.day,
    time: state.timeMode === "now" ? current.time : saved.time,
  };
}

/** Recompute automatic parts at submission; editing one part does not freeze the other. */
export function submissionInstant(
  state: SearchState,
  fields: { day: string; time: string },
  now = new Date(),
) {
  const current = localFields(now);
  if (state.dayMode === "today" && state.timeMode === "now")
    return now.toISOString().replace(/\.\d{3}Z$/, "Z");
  return formInstant(
    state.dayMode === "today" ? current.day : fields.day,
    state.timeMode === "now" ? current.time : fields.time,
  );
}
