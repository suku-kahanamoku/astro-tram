import { NavLink } from "../../UIModule/hooks/useUrlNavigation";
import type { Stop } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

/** Shared stop name and metadata; each view supplies its own map destination. */
export default function StopLabel({
  stop,
  t,
  href,
  requestStop = false,
  linkAttributes,
}: {
  stop: Stop;
  t: Dictionary;
  href?: string | null;
  requestStop?: boolean | null;
  linkAttributes?: Record<`data-${string}`, string | number | undefined>;
}) {
  const hasLocation = stop.id || (stop.lat !== null && stop.lon !== null);
  return (
    <>
      {href && hasLocation ? (
        <NavLink
          {...linkAttributes}
          className="stop-map-link"
          data-nav
          aria-haspopup="dialog"
          href={href}
        >
          {stop.name}
        </NavLink>
      ) : (
        stop.name
      )}
      {requestStop && (
        <>
          {" "}
          <abbr
            className="request-stop"
            title={t.requestStop}
            aria-label={t.requestStop}
          >
            z
          </abbr>
        </>
      )}
      {stop.platform && (
        <>
          {" "}
          <small>
            · {t.platform} {stop.platform}
          </small>
        </>
      )}
    </>
  );
}
