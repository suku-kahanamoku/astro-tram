/** Page-scoped cache of public static responses. No persistent browser storage. */
export class StaticResponseCache {
  private entries = new Map<
    string,
    { json: string; expires: number; bytes: number }
  >();
  private pending = new Map<
    string,
    { controller: AbortController; value: Promise<unknown>; users: number }
  >();
  private bytes = 0;
  constructor(
    private limits: { entries: number; bytes: number; pending: number },
    private now = () => performance.now(),
  ) {
    if (
      !Number.isInteger(limits.entries) ||
      limits.entries < 1 ||
      limits.entries > 10000 ||
      !Number.isInteger(limits.bytes) ||
      limits.bytes < 1 ||
      limits.bytes > 32 * 1024 * 1024 ||
      !Number.isInteger(limits.pending) ||
      limits.pending < 1 ||
      limits.pending > 256
    )
      throw new RangeError("Invalid static response cache limits");
  }

  get<T>(
    key: string,
    ttl: number,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 86400000)
      return Promise.reject(
        new RangeError("Invalid static response cache TTL"),
      );
    if (signal?.aborted)
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    for (const [id, entry] of this.entries)
      if (entry.expires <= this.now()) this.remove(id);
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return Promise.resolve(JSON.parse(hit.json) as T);
    }
    let task = this.pending.get(key);
    if (!task) {
      if (this.pending.size >= this.limits.pending)
        return load(signal ?? new AbortController().signal);
      const controller = new AbortController();
      task = { controller, users: 0, value: Promise.resolve() };
      const current = task;
      current.value = Promise.resolve()
        .then(() => load(controller.signal))
        .then((value) => {
          if (
            !controller.signal.aborted &&
            StaticResponseCache.isStatic(value)
          ) {
            const json = JSON.stringify(value);
            const bytes = new TextEncoder().encode(json).length;
            if (bytes <= this.limits.bytes) {
              this.remove(key);
              while (
                this.entries.size >= this.limits.entries ||
                this.bytes + bytes > this.limits.bytes
              )
                this.remove(this.entries.keys().next().value!);
              this.entries.set(key, { json, bytes, expires: this.now() + ttl });
              this.bytes += bytes;
            }
          }
          return value;
        })
        .finally(() => {
          if (this.pending.get(key) === current) this.pending.delete(key);
        });
      this.pending.set(key, task);
    }
    const shared = task;
    shared.users++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = () => {
        if (done) return false;
        done = true;
        signal?.removeEventListener("abort", abort);
        shared.users--;
        return true;
      };
      const abort = () => {
        if (!finish()) return;
        if (!shared.users && this.pending.get(key) === shared) {
          this.pending.delete(key);
          shared.controller.abort();
        }
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      shared.value.then(
        (value) => {
          if (finish()) resolve(structuredClone(value) as T);
        },
        (error) => {
          if (finish()) reject(error);
        },
      );
    });
  }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) {
      this.bytes -= entry.bytes;
      this.entries.delete(key);
    }
  }
  static isStatic(value: unknown): boolean {
    if (!value || typeof value !== "object") return true;
    const data = value as Record<string, unknown>;
    if (
      data.realtime === true ||
      data.cancelled === true ||
      data.partial === true ||
      data.success === false
    )
      return false;
    if (
      [
        "position",
        "delaySeconds",
        "delay_seconds",
        "expectedArrival",
        "expectedDeparture",
        "expected_arrival",
        "expected_departure",
        "predictionValidUntil",
        "prediction_valid_until",
        "validUntil",
        "valid_until",
        "observedAt",
        "observed_at",
        "ticket",
      ].some((key) => data[key] != null)
    )
      return false;
    return Object.values(data).every((item) =>
      StaticResponseCache.isStatic(item),
    );
  }
}
