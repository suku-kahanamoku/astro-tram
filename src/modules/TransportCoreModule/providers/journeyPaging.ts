import type { Journey, SearchState } from "../types";

export function journeyPageTime(journey: Journey, arrive: boolean) {
  return Date.parse(
    arrive
      ? journey.legs.at(-1)!.scheduledArrival
      : journey.legs[0].scheduledDeparture,
  );
}

/** Use scheduled page boundaries; realtime updates never move the next page. */
export function adjacentJourneyPage(
  state: SearchState,
  journeys: Journey[],
  page: "earlier" | "later",
): SearchState {
  const arrive = page === "earlier";
  const times = journeys.map((journey) => journeyPageTime(journey, arrive));
  const boundary = arrive ? Math.min(...times) : Math.max(...times);
  return {
    ...state,
    page,
    at: new Date(boundary + (arrive ? -1000 : 1000))
      .toISOString()
      .replace(".000Z", "Z"),
  };
}
