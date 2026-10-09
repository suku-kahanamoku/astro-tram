import Collapse from "../../UIModule/components/Collapse";
import JourneySummary from "./JourneySummary";
import JourneyDetail from "./JourneyDetail";
import type { Journey, Trip } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";
export default function JourneyCard({
  journey: j,
  open,
  t,
  locale,
  url,
  trip,
  tripError,
}: {
  journey: Journey;
  open: boolean;
  t: Dictionary;
  locale: string;
  url: URL;
  trip?: Trip;
  tripError?: string;
}) {
  return (
    <article
      className={`journey-card ${open ? "is-open" : ""}`}
      data-journey={j.key}
    >
      <JourneySummary journey={j} open={open} t={t} locale={locale} url={url} />
      {(j.source.mode === "fallback" || j.legs.some((l) => l.cancelled)) && (
        <div className="journey-meta">
          <span className={j.source.mode === "fallback" ? "fallback" : ""}>
            {j.source.mode === "fallback" ? t.fallback : t.cancelled}
            {j.source.mode === "fallback" && j.legs.some((l) => l.cancelled)
              ? ` · ${t.cancelled}`
              : ""}
          </span>
          {j.source.mode === "fallback" && (
            <span>{j.source.attribution || j.source.provider}</span>
          )}
        </div>
      )}
      <Collapse open={open}>
        <JourneyDetail
          journey={j}
          t={t}
          locale={locale}
          url={url}
          trip={trip}
          tripError={tripError}
        />
      </Collapse>
    </article>
  );
}
