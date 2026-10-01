import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { consentProvider } from "../providers/consent";
import { renderAd } from "../providers/advertising";
import type { AdUnit } from "../../../config/ads";
const snapshot = () => consentProvider.advertising;
const serverSnapshot = () => false;
export function useAds(ref: RefObject<HTMLDivElement | null>, unit: AdUnit) {
  const allowed = useSyncExternalStore(
    consentProvider.subscribe,
    snapshot,
    serverSnapshot,
  );
  const issued = useRef(false);
  const [state, setState] = useState<"idle" | "requested" | "unavailable">(
    "idle",
  );
  useEffect(() => {
    const target = ref.current;
    if (!target || unit.provider === "placeholder") return;
    if (!allowed) {
      if (issued.current) location.reload();
      return;
    }
    let disposed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          issued.current ||
          !consentProvider.advertising ||
          !target.getClientRects().length ||
          !entries.some((e) => e.isIntersecting)
        )
          return;
        issued.current = true;
        setState("requested");
        void renderAd(target, unit).catch(() => {
          if (!disposed) setState("unavailable");
        });
      },
      { rootMargin: "100px" },
    );
    observer.observe(target);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [allowed, unit, ref]);
  return state;
}
