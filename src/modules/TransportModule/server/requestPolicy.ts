/** Veřejné čtecí POST routy: žádná změna účtu ani vytvoření tracking ticketu. */
const publicReadPaths = new Set([
  "/api/transport/places/",
  "/api/transport/search/",
]);

export function isPublicTransportRead(request: Request): boolean {
  return (
    request.method === "POST" &&
    publicReadPaths.has(new URL(request.url).pathname)
  );
}
