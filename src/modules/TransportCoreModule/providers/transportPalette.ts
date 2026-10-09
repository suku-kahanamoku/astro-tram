/** Public presentation contract owned by Java; never infer colors from a mode locally. */
export interface ModePalette {
  background: string;
  foreground: string;
}
export type TransportPalette = Readonly<Record<string, ModePalette>>;

export function projectTransportPalette(value: unknown): TransportPalette {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid_transport_palette");
  const entries = Object.entries(value);
  if (!entries.length || entries.length > 128)
    throw new Error("invalid_transport_palette");
  const result: Record<string, ModePalette> = Object.create(null);
  for (const [mode, raw] of entries) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(mode) || !raw || typeof raw !== "object")
      throw new Error("invalid_transport_palette");
    const color = raw as Record<string, unknown>;
    if (
      ![color.background, color.foreground].every(
        (v) => typeof v === "string" && /^#[a-f\d]{6}$/i.test(v),
      )
    )
      throw new Error("invalid_transport_palette");
    result[mode] = Object.freeze({
      background: color.background as string,
      foreground: color.foreground as string,
    });
  }
  if (!Object.hasOwn(result, "transport"))
    throw new Error("invalid_transport_palette");
  return Object.freeze(result);
}

export function modePalette(
  palette: TransportPalette,
  mode: string,
): ModePalette | undefined {
  return Object.hasOwn(palette, mode) ? palette[mode] : palette.transport;
}

/** One in-flight request shared by all React islands; no polling or per-badge requests. */
export function createTransportPaletteStore(load: () => Promise<unknown>) {
  const empty: TransportPalette = Object.freeze({});
  let snapshot = empty;
  let pending: Promise<void> | undefined;
  let retryAt = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ensure: () => {
      if (snapshot !== empty || Date.now() < retryAt) return Promise.resolve();
      if (!pending) {
        pending = Promise.resolve()
          .then(load)
          .then((raw) => {
            snapshot = projectTransportPalette(raw);
            for (const listener of listeners) listener();
          })
          .catch(() => {
            // A later mount may retry; failed Java must not trigger request storms.
            retryAt = Date.now() + 5000;
          })
          .finally(() => {
            pending = undefined;
          });
      }
      return pending;
    },
  };
}
