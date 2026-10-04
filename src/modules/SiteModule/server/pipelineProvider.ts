import type { CoreClient } from "../../CoreModule/server/php-core";
import { HttpError } from "../../CoreModule/server/errors";
import type { PipelineAction, PipelineState } from "../types";

/** Project only UI state. Cloudflare credentials and runner leases never enter the browser. */
export function projectPipeline(
  value: unknown,
  requireRunner = true,
): PipelineState {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(502, "invalid_backend_response");
  const raw = value as Record<string, unknown>;
  if (
    !["idle", "queued", "running", "ready", "failed"].includes(
      raw.status as string,
    ) ||
    (requireRunner &&
      (!raw.runner ||
        typeof raw.runner !== "object" ||
        typeof (raw.runner as Record<string, unknown>).online !== "boolean")) ||
    (raw.status !== "idle" &&
      (typeof raw.id !== "string" ||
        !/^[a-f0-9-]{36}$/.test(raw.id) ||
        !["sync_build", "deploy"].includes(raw.action as string)))
  )
    throw new HttpError(502, "invalid_backend_response");
  return {
    status: raw.status as PipelineState["status"],
    ...(raw.status !== "idle"
      ? {
          id: raw.id as string,
          action: raw.action as PipelineAction,
        }
      : {}),
    ...(typeof raw.phase === "string" &&
    /^[a-zA-Z0-9_:.-]{1,120}$/.test(raw.phase)
      ? { phase: raw.phase }
      : {}),
    runner:
      raw.runner &&
      typeof raw.runner === "object" &&
      typeof (raw.runner as Record<string, unknown>).online === "boolean"
        ? { online: (raw.runner as { online: boolean }).online }
        : null,
  };
}

export function createPipelineProvider(core: CoreClient) {
  return {
    async status(token: string) {
      return projectPipeline(
        await core.request("/transport-admin/local-pipeline", { token }),
      );
    },
    async submit(action: PipelineAction, token: string) {
      return projectPipeline(
        await core.request("/transport-admin/local-pipeline", {
          method: "POST",
          token,
          body: { action },
        }),
        false,
      );
    },
  };
}
