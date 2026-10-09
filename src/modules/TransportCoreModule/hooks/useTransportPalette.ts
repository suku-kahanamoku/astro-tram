import { useEffect, useSyncExternalStore } from "react";
import { transportClient } from "../providers/client";
import { createTransportPaletteStore } from "../providers/transportPalette";

const palette = createTransportPaletteStore(() =>
  transportClient.presentation(),
);

export function useTransportPalette() {
  const snapshot = useSyncExternalStore(
    palette.subscribe,
    palette.getSnapshot,
    palette.getServerSnapshot,
  );
  useEffect(() => {
    void palette.ensure();
  }, []);
  return snapshot;
}
