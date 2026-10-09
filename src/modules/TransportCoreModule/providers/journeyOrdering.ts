import type { Journey } from "../types";
import { isWalkingJourney } from "./journeyIdentity";
import { journeyPageTime } from "./journeyPaging";

/** Timetable order; live predictions never move result cards. */
export function compareJourneys(a: Journey, b: Journey): number {
  const departureA = journeyPageTime(a, false),
    departureB = journeyPageTime(b, false),
    arrivalA = journeyPageTime(a, true),
    arrivalB = journeyPageTime(b, true);
  return (
    departureA - departureB ||
    arrivalA - arrivalB ||
    arrivalA - departureA - (arrivalB - departureB) ||
    a.transfers - b.transfers
  );
}

/** Apply to distinct results before LIMIT, not to walking legs of a transit journey. */
export function eligibleJourneys(journeys: Journey[]): Journey[] {
  const transit = journeys.filter((journey) => !isWalkingJourney(journey));
  return transit.length >= 3 ? transit : journeys;
}
