export function safeWebUrl(value: string): string | null {
  try {
    if (/\s|[<>"']/u.test(value)) return null;
    const url = new URL(value.startsWith("www.") ? `https://${value}` : value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
