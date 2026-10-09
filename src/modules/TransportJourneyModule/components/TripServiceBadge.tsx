import type { ComponentProps } from "react";
import TransportBadge from "../../TransportCoreModule/components/TransportBadge";
import TripObservationStatus from "./TripObservationStatus";
import type {
  Leg,
  Trip,
  TripObservation,
} from "../../TransportCoreModule/types";

/** One service identity and live status layout for accordion and dialog. */
export default function TripServiceBadge({
  leg,
  trip,
  live,
  ...props
}: Omit<ComponentProps<typeof TransportBadge>, "mode" | "line"> & {
  leg: Leg;
  trip?: Trip;
  live?: TripObservation;
}) {
  return (
    <span className="trip-service-badge">
      <TransportBadge {...props} mode={leg.mode} line={leg.line} />
      <TripObservationStatus leg={leg} trip={trip} live={live} t={props.t} />
    </span>
  );
}
