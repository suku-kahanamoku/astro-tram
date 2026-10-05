export type PipelineAction = "sync_build" | "deploy";
export interface OnlinePlannerState {
  enabled: boolean;
}
export interface PipelineState {
  status: "idle" | "queued" | "running" | "ready" | "failed";
  action?: PipelineAction;
  id?: string;
  phase?: string;
  runner: { online: boolean } | null;
}
