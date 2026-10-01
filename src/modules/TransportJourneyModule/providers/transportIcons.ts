import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export function modeLabel(mode: string, t: Dictionary): string {
  return (t as Record<string, string>)[`mode_${mode}`] ?? t.mode_transport;
}
