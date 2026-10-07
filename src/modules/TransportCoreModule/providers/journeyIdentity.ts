import type { Journey, Leg, Stop } from "../types";

function stopIdentity(stop: Stop) {
  return stop.id ?? [stop.name, stop.lat, stop.lon];
}

export function isWalkingJourney(journey: Pick<Journey, "legs">): boolean {
  return (
    journey.legs.length > 0 && journey.legs.every((leg) => leg.mode === "walk")
  );
}

/** Walking has no timetable: moving its departure is not a new route. */
export function journeyIdentity(journey: Pick<Journey, "legs">): string {
  return JSON.stringify(
    journey.legs.map((leg: Leg) => [
      leg.mode,
      stopIdentity(leg.from),
      stopIdentity(leg.to),
      ...(leg.mode === "walk"
        ? [
            Date.parse(leg.scheduledArrival) -
              Date.parse(leg.scheduledDeparture),
            leg.geometry,
          ]
        : [
            leg.tripId,
            leg.line,
            leg.operator,
            Date.parse(leg.scheduledDeparture),
            Date.parse(leg.scheduledArrival),
          ]),
    ]),
  );
}
