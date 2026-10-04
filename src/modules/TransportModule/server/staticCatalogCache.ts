type Entry = {
  pending: Promise<unknown>;
  expiresAt: number;
  bytes: number;
  ready: boolean;
};
/** Only public city catalogues use this short-lived server cache; never observations or GPS queries. */
export function createStaticCatalogCache(
  now = Date.now,
  ttlMs = 30_000,
  capacity = 32,
  byteLimit = 4 * 1024 * 1024,
) {
  const entries = new Map<string, Entry>();
  let bytes = 0;
  const remove = (key: string, entry: Entry) => {
    if (entries.get(key) !== entry) return;
    entries.delete(key);
    bytes -= entry.bytes;
  };
  const trim = (count = capacity) => {
    for (const [key, entry] of entries) {
      if (
        entry.ready &&
        (entry.expiresAt <= now() || entries.size > count || bytes > byteLimit)
      )
        remove(key, entry);
    }
  };
  return {
    async get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const previous = entries.get(key);
      if (previous && (!previous.ready || previous.expiresAt > now())) {
        entries.delete(key);
        entries.set(key, previous);
        return structuredClone(await previous.pending) as T;
      }
      trim(capacity - 1);
      if (entries.size >= capacity) return load();
      const entry: Entry = {
        pending: Promise.resolve(),
        expiresAt: Infinity,
        bytes: 0,
        ready: false,
      };
      entries.set(key, entry);
      entry.pending = Promise.resolve()
        .then(load)
        .then((value) => {
          const snapshot = structuredClone(value);
          entry.bytes = Buffer.byteLength(JSON.stringify(snapshot));
          bytes += entry.bytes;
          entry.ready = true;
          entry.expiresAt = now() + ttlMs;
          trim();
          return snapshot;
        })
        .catch((error) => {
          remove(key, entry);
          throw error;
        });
      return structuredClone(await entry.pending) as T;
    },
  };
}
export const staticCatalogCache = createStaticCatalogCache();
