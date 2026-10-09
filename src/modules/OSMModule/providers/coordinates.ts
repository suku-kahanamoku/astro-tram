export function validMapCoordinates(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

export function normalizeLongitude(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Invalid geometry splits the line; never invent a connecting segment over missing data. */
export function routeSegments(
  coordinates: ReadonlyArray<ReadonlyArray<number>>,
) {
  const segments: [number, number][][] = [];
  let segment: [number, number][] = [];
  const flush = () => {
    if (segment.length >= 2) segments.push(segment);
    segment = [];
  };
  for (const coordinate of coordinates) {
    if (validMapCoordinates(coordinate[1], coordinate[0]))
      segment.push([coordinate[0], coordinate[1]]);
    else flush();
  }
  flush();
  return segments;
}
