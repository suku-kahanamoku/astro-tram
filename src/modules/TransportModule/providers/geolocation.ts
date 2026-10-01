import type { Fix } from "../types";
import { validCoordinates } from "./state";
import { transportClientConfig as config } from "../config/client";
export function freshPosition(lat: number, lon: number, timestamp: number) {
  const age = Date.now() - timestamp;
  return (
    Number.isFinite(age) &&
    age <= config.gpsMaxAgeMs &&
    age >= -config.gpsFutureToleranceMs &&
    validCoordinates(lat, lon)
  );
}
/** Only in-memory measurements. Call anew for each search; never persist or put in a URL. */
export function getFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("location"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (
          !freshPosition(p.coords.latitude, p.coords.longitude, p.timestamp)
        ) {
          reject(new Error("stale_location"));
          return;
        }
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          observedAt: new Date(p.timestamp)
            .toISOString()
            .replace(/\.\d{3}Z$/, "Z"),
        });
      },
      () => reject(new Error("location")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: config.gpsTimeoutMs },
    );
  });
}
