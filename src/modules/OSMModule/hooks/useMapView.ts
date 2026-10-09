import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  MapConfig,
  MapFix,
  MapPlace,
  MapPoint,
  MapRoute,
  MapTexts,
} from "../types";

interface Options {
  open: boolean;
  identity: string;
  mode: string | null;
  place?: MapPlace;
  stop?: MapPoint;
  waiting: boolean;
  journey?: MapRoute;
  country: string;
  config: MapConfig;
  texts: MapTexts;
  resolveStop: (id: string, signal: AbortSignal) => Promise<MapPoint>;
  getCurrentLocation: () => Promise<MapFix>;
  isFreshPosition: (lat: number, lon: number, timestamp: number) => boolean;
  onPick: (lat: number, lon: number) => void;
}

export function useMapView(
  canvas: RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const {
    open,
    identity,
    mode,
    place,
    stop,
    waiting,
    journey,
    country,
    config,
    texts,
    resolveStop,
    getCurrentLocation,
    isFreshPosition,
    onPick,
  } = options;
  const attachMap = useRef<
    ((target: HTMLElement | undefined) => void) | undefined
  >(undefined);
  const canvasReady = useRef<
    ((target: HTMLDivElement | null) => void) | undefined
  >(undefined);
  const mount = useCallback(
    (element: HTMLDivElement | null) => {
      canvas.current = element;
      attachMap.current?.(element ?? undefined);
      if (element) canvasReady.current?.(element);
    },
    [canvas],
  );
  const retiredMap = useRef<(() => void) | undefined>(undefined);
  const pick = useRef(onPick);
  pick.current = onPick;
  const [status, setStatus] = useState({ ready: false, message: "", name: "" });
  useEffect(() => {
    if (open) {
      retiredMap.current?.();
      retiredMap.current = undefined;
    }
    if (!open) {
      setStatus({ ready: false, message: "", name: "" });
      return;
    }
    if (waiting) {
      setStatus({ ready: false, message: texts.loadingStopMap, name: "" });
      return;
    }
    const abort = new AbortController();
    let disposed = false;
    let handle:
      ReturnType<typeof import("../providers/map").createMap> | undefined;
    let watch: number | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const readOnly =
      mode === "stop" ||
      mode === "walk" ||
      place?.type === "stop" ||
      place?.type === "current_location";
    const set = (ready: boolean, message = "", name = "") => {
      if (!disposed) setStatus({ ready, message, name });
    };
    set(
      false,
      place?.type === "current_location"
        ? texts.locating
        : readOnly
          ? texts.loadingStopMap
          : "",
    );
    void (async () => {
      try {
        let point = stop;
        let fix: MapFix | undefined;
        let center: [number, number] =
          place?.type === "coordinates" &&
          typeof place.lon === "number" &&
          typeof place.lat === "number"
            ? [place.lon, place.lat]
            : (config.mapCenters[country] ?? config.defaultMapCenter);
        if (place?.type === "current_location") {
          fix = await getCurrentLocation();
          center = [fix.lon, fix.lat];
        }
        if (place?.type === "stop" && place.id)
          point = await resolveStop(place.id, abort.signal);
        if (mode === "stop" || place?.type === "stop") {
          if (!point) throw new Error("missing_stop");
          if ((point.lat === null || point.lon === null) && point.id)
            point = await resolveStop(point.id, abort.signal);
          if (
            point.lat === null ||
            point.lon === null ||
            !Number.isFinite(point.lat) ||
            !Number.isFinite(point.lon) ||
            Math.abs(point.lat) > 90 ||
            Math.abs(point.lon) > 180
          )
            throw new Error("missing_coordinates");
          center = [point.lon, point.lat];
        }
        if (disposed) return;
        const { createMap } = await import("../providers/map");
        if (disposed) return;
        pick.current(center[1], center[0]);
        const target = await new Promise<HTMLDivElement | null>((resolve) => {
          canvasReady.current = resolve;
          set(true, "", stop?.name ?? point?.name ?? "");
          if (canvas.current) resolve(canvas.current);
        });
        canvasReady.current = undefined;
        if (disposed || !target) return;
        handle = createMap(target, {
          center,
          config,
          journey: mode === "journey" || mode === "walk" ? journey : undefined,
          readOnly,
          onPick: (lat, lon) => pick.current(lat, lon),
        });
        attachMap.current = handle.attach;
        requestAnimationFrame(() => {
          if (!disposed) handle?.refresh();
        });
        if (mode === "journey" && handle.features === 0)
          set(true, texts.mapUnavailable);
        if (mode === "walk" && handle.routes === 0)
          set(true, texts.mapUnavailable);
        if (fix) {
          const update = (lat: number, lon: number, timestamp: number) => {
            if (disposed) return;
            clearTimeout(expiry);
            if (!isFreshPosition(lat, lon, timestamp)) {
              handle?.clear();
              set(false, texts.stale);
              return;
            }
            set(true);
            handle?.pick(lat, lon);
            handle?.refresh();
            expiry = setTimeout(
              () => {
                handle?.clear();
                set(false, texts.stale);
              },
              config.gpsMaxAgeMs - Math.max(0, Date.now() - timestamp),
            );
          };
          update(fix.lat, fix.lon, Date.parse(fix.observedAt));
          watch = navigator.geolocation.watchPosition(
            (position) =>
              update(
                position.coords.latitude,
                position.coords.longitude,
                position.timestamp,
              ),
            () => {
              handle?.clear();
              set(false, texts.locationError);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: config.gpsTimeoutMs,
            },
          );
        }
      } catch {
        if (!disposed)
          set(
            false,
            place?.type === "current_location"
              ? texts.locationError
              : mode === "journey" || mode === "walk"
                ? texts.routeMapError
                : readOnly
                  ? texts.stopMapError
                  : texts.mapError,
          );
      }
    })();
    const stopWork = (immediate = false) => {
      disposed = true;
      canvasReady.current?.(null);
      canvasReady.current = undefined;
      attachMap.current = undefined;
      abort.abort();
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      clearTimeout(expiry);
      const map = handle;
      handle = undefined;
      if (!map) return;
      const dialog = canvas.current?.closest("dialog");
      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          map.dispose();
        }
      };
      retiredMap.current = release;
      if (immediate) {
        release();
        return;
      }
      queueMicrotask(() => {
        if (released) return;
        const animations = dialog && !dialog.open ? dialog.getAnimations() : [];
        void Promise.allSettled(
          animations.map((animation) => animation.finished),
        ).then(release);
      });
    };
    const onPageHide = () => {
      retiredMap.current?.();
      stopWork(true);
    };
    window.addEventListener("pagehide", onPageHide, { once: true });
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      stopWork();
    };
  }, [
    open,
    identity,
    waiting,
    place,
    stop,
    journey,
    country,
    config,
    texts.locating,
    texts.loadingStopMap,
    texts.stale,
    texts.locationError,
    texts.stopMapError,
    texts.routeMapError,
    texts.mapError,
    texts.mapUnavailable,
    resolveStop,
    getCurrentLocation,
    isFreshPosition,
    mode,
    canvas,
  ]);
  return { ...status, mount };
}
