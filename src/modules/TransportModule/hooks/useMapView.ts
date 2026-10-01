import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { transportClient } from "../providers/client";
import { getFix, freshPosition } from "../providers/geolocation";
import { validCoordinates } from "../providers/state";
import { transportClientConfig as config } from "../config/client";
import type { Journey, Place, Stop } from "../types";
import type { Dictionary } from "../providers/translations";
interface Options {
  open: boolean;
  identity: string;
  mode: string | null;
  place?: Place;
  stop?: Stop;
  waiting: boolean;
  journey?: Journey;
  country: string;
  t: Dictionary;
  onPick: (lat: number, lon: number) => void;
}
/** React owns lifecycle; OpenLayers alone owns the canvas subtree. */
export function useMapView(
  canvas: RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const { open, identity, mode, place, stop, waiting, journey, country, t } =
    options;
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
  const pick = useRef(options.onPick);
  pick.current = options.onPick;
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
      setStatus({ ready: false, message: t.loadingStopMap, name: "" });
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
      place?.type === "stop" ||
      place?.type === "current_location";
    const set = (ready: boolean, message = "", name = "") => {
      if (!disposed) setStatus({ ready, message, name });
    };
    set(
      false,
      place?.type === "current_location"
        ? t.locating
        : readOnly
          ? t.loadingStopMap
          : "",
    );
    void (async () => {
      try {
        let point = stop;
        let fix: Awaited<ReturnType<typeof getFix>> | undefined;
        let center: [number, number] =
          place?.type === "coordinates"
            ? [place.lon, place.lat]
            : (config.mapCenters[country] ?? config.defaultMapCenter);
        if (place?.type === "current_location") {
          fix = await getFix();
          center = [fix.lon, fix.lat];
        }
        if (place?.type === "stop")
          point = await transportClient.stop(place.id, abort.signal);
        if (mode === "stop" || place?.type === "stop") {
          if (!point) throw new Error("missing_stop");
          if ((point.lat === null || point.lon === null) && point.id)
            point = await transportClient.stop(point.id, abort.signal);
          if (
            point.lat === null ||
            point.lon === null ||
            !validCoordinates(point.lat, point.lon)
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
          journey: mode === "journey" ? journey : undefined,
          readOnly,
          onPick: (lat, lon) => pick.current(lat, lon),
        });
        attachMap.current = handle.attach;
        requestAnimationFrame(() => {
          if (!disposed) handle?.refresh();
        });
        if (mode === "journey" && handle.features === 0)
          set(true, t.mapUnavailable);
        if (fix) {
          const update = (lat: number, lon: number, timestamp: number) => {
            if (disposed) return;
            clearTimeout(expiry);
            if (!freshPosition(lat, lon, timestamp)) {
              handle?.clear();
              set(false, t.stale);
              return;
            }
            set(true);
            handle?.pick(lat, lon);
            handle?.refresh();
            expiry = setTimeout(
              () => {
                handle?.clear();
                set(false, t.stale);
              },
              config.gpsMaxAgeMs - Math.max(0, Date.now() - timestamp),
            );
          };
          update(fix.lat, fix.lon, Date.parse(fix.observedAt));
          watch = navigator.geolocation.watchPosition(
            (p) => update(p.coords.latitude, p.coords.longitude, p.timestamp),
            () => {
              handle?.clear();
              set(false, t.locationError);
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
              ? t.locationError
              : readOnly
                ? t.stopMapError
                : mode === "journey"
                  ? t.routeMapError
                  : t.mapError,
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
      // Passive cleanups precede Dialog's close effect. Wait until that commit
      // finishes before inspecting exit animations; GPS work already stopped.
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
  }, [open, identity, waiting, stop, journey, country, t, canvas]);
  return { ...status, mount };
}
