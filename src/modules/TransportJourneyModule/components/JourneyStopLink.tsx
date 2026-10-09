import StopLabel from "./StopLabel";
import { navHref } from "../providers/render";
import type { Stop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function JourneyStopLink({
  stop,
  index,
  side,
  url,
  t,
}: {
  stop: Stop;
  index: number;
  side: string;
  url: URL;
  t: Dictionary;
}) {
  return (
    <StopLabel
      stop={stop}
      t={t}
      linkAttributes={{ "data-stop-map": `${index}-${side}` }}
      href={navHref(url, {
        map: "stop",
        stopLeg: String(index),
        stopSide: side,
        leg: null,
        tripStop: null,
      })}
    />
  );
}
