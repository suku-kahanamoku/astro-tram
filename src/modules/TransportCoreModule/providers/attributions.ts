import type { DataAttribution } from "../types";

/** Public document links must never reveal internal hosts or download credentials. */
export function publicAttributionUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /\s|[<>"']/u.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (
      (!host.includes(".") && !host.startsWith("[")) ||
      /(?:^|\.)(localhost|local|internal|lan|home|arpa)$/.test(host)
    )
      return null;
    if (/^\d+(?:\.\d+){3}$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || b === 0)) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 198 && (b === 18 || b === 19))
      )
        return null;
    }
    // Only global unicast IPv6; loopback, mapped IPv4 and local ranges are excluded.
    if (host.startsWith("[") && !/^\[[23][0-9a-f]{3}:/.test(host)) return null;
    const credential =
      /(?:api[_-]?key|(?:^|[_-])(?:token|key|secret|password|authorization|auth|signature|sig|credential)(?:$|[_-]))/i;
    if (
      [...url.searchParams.keys()].some((key) => credential.test(key)) ||
      credential.test(url.hash)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new TypeError("invalid_attributions");
  return value;
}
function instant(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new TypeError("invalid_attributions");
  return value;
}

/** Whitelist source metadata; invalid required credits are not silently truncated. */
export function projectAttributions(value: unknown): DataAttribution[] {
  if (!Array.isArray(value) || value.length > 500)
    throw new TypeError("invalid_attributions");
  const ids = new Set<string>();
  return value.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new TypeError("invalid_attributions");
    const row = value as Record<string, unknown>;
    const id = string(row.id, 256);
    if (ids.has(id)) throw new TypeError("invalid_attributions");
    ids.add(id);
    const license = publicAttributionUrl(row.license_url);
    if (
      !license ||
      !Array.isArray(row.requirements) ||
      row.requirements.length > 50
    )
      throw new TypeError("invalid_attributions");
    return {
      id,
      feed_id: row.feed_id == null ? null : string(row.feed_id, 256),
      name: string(row.name, 512),
      attribution: string(row.attribution, 8000),
      license_url: license,
      source_url: publicAttributionUrl(row.source_url),
      published_at: instant(row.published_at),
      updated_at: instant(row.updated_at),
      requirements: row.requirements.map((note) => string(note, 8000)),
    };
  });
}
