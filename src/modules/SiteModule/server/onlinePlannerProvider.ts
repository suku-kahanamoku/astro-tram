import type { CoreClient } from "../../CoreModule/server/php-core";
import { HttpError } from "../../CoreModule/server/errors";
import type { OnlinePlannerState } from "../types";
export function projectOnlinePlanners(value: unknown): OnlinePlannerState {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof (value as OnlinePlannerState).enabled !== "boolean"
  )
    throw new HttpError(502, "invalid_backend_response");
  return { enabled: (value as OnlinePlannerState).enabled };
}

export function createOnlinePlannerProvider(core: CoreClient) {
  return {
    async onlinePlanners(token: string) {
      return projectOnlinePlanners(
        await core.request("/transport-admin/online-planners", { token }),
      );
    },
    async setOnlinePlanners(enabled: boolean, token: string) {
      return projectOnlinePlanners(
        await core.request("/transport-admin/online-planners", {
          method: "POST",
          token,
          body: { enabled },
        }),
      );
    },
  };
}
