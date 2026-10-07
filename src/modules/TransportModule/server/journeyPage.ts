import { journeyPaging } from "../../TransportCoreModule/config/journeyPaging";
import { journeyPageTime } from "../../TransportCoreModule/providers/journeyPaging";
import {
  isWalkingJourney,
  journeyIdentity,
} from "../../TransportCoreModule/providers/journeyIdentity";
import type { Journey, SearchResult } from "../../TransportCoreModule/types";

/** Fill a count-based page even when an upstream planner returns a short time window. */
export async function collectJourneyPage<T extends SearchResult>(
  body: Record<string, unknown>,
  fetchBatch: (body: Record<string, unknown>, timeoutMs: number) => Promise<T>,
  now = Date.now,
): Promise<T> {
  const arrive = typeof body["to-date"] === "string";
  const dateKey = arrive ? "to-date" : "from-date";
  const start = Date.parse(String(body[dateKey]));
  const direction = arrive ? -1 : 1;
  const deadline = now() + journeyPaging.timeoutMs;
  const found = new Map<string, Journey>();
  let cursor = start;
  let result: T | undefined;
  let partial = false;
  let walkingOnly = false;
  for (let request = 0; request < journeyPaging.maxRequests; request++) {
    const remaining = deadline - now();
    if (remaining <= 0) break;
    let batch: T;
    try {
      batch = await fetchBatch(
        {
          ...body,
          ...(Number.isFinite(cursor)
            ? {
                [dateKey]: new Date(cursor).toISOString().replace(".000Z", "Z"),
              }
            : {}),
        },
        remaining,
      );
    } catch (error) {
      if (!result) throw error;
      partial = true;
      break;
    }
    result ??= batch;
    partial ||= batch.partial;
    for (const journey of batch.journeys) {
      const time = journeyPageTime(journey, arrive);
      const identity = journeyIdentity(journey);
      if (
        (!Number.isFinite(start) || (time - start) * direction >= 0) &&
        !found.has(identity)
      )
        found.set(identity, journey);
    }
    // A walking-only response cannot fill a timetable page by advancing the clock.
    walkingOnly =
      batch.journeys.length > 0 && batch.journeys.every(isWalkingJourney);
    if (
      found.size >= journeyPaging.size ||
      walkingOnly ||
      batch.partial ||
      !Number.isFinite(start)
    )
      break;
    const times = batch.journeys
      .filter((journey) => !isWalkingJourney(journey))
      .map((journey) => journeyPageTime(journey, arrive))
      .filter(Number.isFinite);
    const edge = times.length
      ? arrive
        ? Math.min(...times)
        : Math.max(...times)
      : cursor;
    cursor =
      (edge - cursor) * direction >= 0 && times.length
        ? edge + direction * 1000
        : cursor + direction * journeyPaging.scanStepMs;
    if (Math.abs(cursor - start) > journeyPaging.horizonMs) break;
  }
  const journeys = [...found.values()]
    .sort(
      (a, b) =>
        direction * (journeyPageTime(a, arrive) - journeyPageTime(b, arrive)),
    )
    .slice(0, journeyPaging.size)
    .sort((a, b) => journeyPageTime(a, arrive) - journeyPageTime(b, arrive));
  return {
    ...result!,
    journeys,
    partial:
      partial ||
      (!walkingOnly &&
        !result?.partial &&
        journeys.length < journeyPaging.size),
  };
}
