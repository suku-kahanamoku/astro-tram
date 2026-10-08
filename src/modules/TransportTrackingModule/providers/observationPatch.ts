import type { TripObservation } from "../../TransportCoreModule/types";
import { unavailableObservation } from "./tracking";

/** Independent source lifetimes: a GPS-only frame must not erase or extend a delay. */
export function mergeObservation(
  previous: TripObservation | undefined,
  incoming: TripObservation,
  now = Date.now(),
): TripObservation {
  const fresh = (sample?: { observedAt: string; validUntil: string }) =>
    !!sample && Date.parse(sample.validUntil) > now;
  const sample =
    incoming.observedAt && incoming.validUntil
      ? { observedAt: incoming.observedAt, validUntil: incoming.validUntil }
      : undefined;
  const old =
    previous?.observedAt && previous.validUntil
      ? { observedAt: previous.observedAt, validUntil: previous.validUntil }
      : undefined;
  const oldPosition =
    previous?.positionSample ??
    (old && previous?.position
      ? { ...old, status: previous.status }
      : undefined);
  const oldDelay =
    previous?.delaySample ?? (previous?.delaySeconds != null ? old : undefined);
  const newer = (candidate: typeof sample, current: typeof sample) =>
    fresh(candidate) &&
    (!fresh(current) ||
      Date.parse(candidate!.observedAt) >= Date.parse(current!.observedAt));
  const incomingPosition =
    incoming.positionSample ??
    (sample ? { ...sample, status: incoming.status } : undefined);
  const incomingDelay = incoming.delaySample ?? sample;
  const usePosition =
    !!incoming.position && newer(incomingPosition, oldPosition);
  const useDelay =
    incoming.delaySeconds !== null &&
    incoming.status === "live" &&
    newer(incomingDelay, oldDelay);
  if (
    previous &&
    !usePosition &&
    !useDelay &&
    (fresh(oldPosition) || fresh(oldDelay)) &&
    (!previous.position || fresh(oldPosition)) &&
    (previous.delaySeconds === null || fresh(oldDelay)) &&
    (incoming.cancelled === null || incoming.cancelled === previous.cancelled)
  )
    return previous;
  const position = usePosition
    ? incoming.position
    : fresh(oldPosition)
      ? (previous?.position ?? null)
      : null;
  const delaySeconds = useDelay
    ? incoming.delaySeconds
    : fresh(oldDelay)
      ? (previous?.delaySeconds ?? null)
      : null;
  const positionSample = position
    ? usePosition
      ? incomingPosition
      : oldPosition
    : undefined;
  const delaySample =
    delaySeconds !== null ? (useDelay ? incomingDelay : oldDelay) : undefined;
  if (!position && delaySeconds === null) return incoming;
  const samples = [positionSample, delaySample].filter((s) => !!s);
  return {
    ...unavailableObservation(),
    ...incoming,
    status:
      delaySeconds !== null || positionSample?.status === "live"
        ? "live"
        : "last_known",
    position,
    delaySeconds,
    positionSample,
    delaySample,
    observedAt: samples
      .map((s) => s.observedAt)
      .sort()
      .at(-1)!,
    validUntil: samples
      .map((s) => s.validUntil)
      .sort()
      .at(-1)!,
    cancelled:
      incoming.cancelled ??
      (fresh(oldDelay) ? (previous?.cancelled ?? null) : null),
  };
}
