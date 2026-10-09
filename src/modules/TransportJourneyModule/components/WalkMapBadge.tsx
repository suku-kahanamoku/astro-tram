import { useUrlNavigation } from "../../UIModule/hooks/useUrlNavigation";
import TransportBadge from "../../TransportCoreModule/components/TransportBadge";
import { journeyContext } from "../providers/journeyExpansion";
import { navHref } from "../providers/render";
import type { Journey } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function WalkMapBadge({
  journey,
  index,
  url,
  t,
}: {
  journey: Journey;
  index: number;
  url: URL;
  t: Dictionary;
}) {
  const { navigate } = useUrlNavigation();
  const leg = journey.legs[index];
  return (
    <TransportBadge
      as="button"
      type="button"
      mode="walk"
      t={t}
      className="walk-map-open"
      data-walk-map={index}
      aria-haspopup="dialog"
      aria-label={`${t.walkMap}: ${leg.from.name} → ${leg.to.name}`}
      onClick={() =>
        navigate(
          navHref(journeyContext(url, journey.key), {
            map: "walk",
            stopLeg: String(index),
            stopSide: null,
            leg: null,
            tripStop: null,
          }),
        )
      }
    />
  );
}
