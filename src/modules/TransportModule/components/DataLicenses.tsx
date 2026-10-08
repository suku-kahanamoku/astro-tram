import { useEffect, useState } from "react";
import TransportAttributions from "./TransportAttributions";
import { dictionary } from "../../TransportCoreModule/providers/translations";
import { transportClient } from "../../TransportCoreModule/providers/client";
import type { Locale } from "../../LangModule/config";
import type { DataAttribution } from "../../TransportCoreModule/types";
import {
  supplementaryDataLicenses,
  supplementaryGtfsLicenses,
} from "../config/data-licenses";

export default function DataLicenses({ locale }: { locale: Locale }) {
  const t = dictionary(locale);
  const [sources, setSources] = useState<DataAttribution[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void transportClient
      .attributions(
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      )
      .then(
        (data) => {
          if (!controller.signal.aborted) setSources(data);
        },
        () => {
          if (!controller.signal.aborted) setUnavailable(true);
        },
      );
    return () => controller.abort();
  }, []);
  return (
    <>
      {sources?.length ? (
        <TransportAttributions locale={locale} sources={sources} />
      ) : (
        <section
          className="transport-attributions"
          data-attributions-status
          aria-busy={sources === null && !unavailable}
        >
          <h2>{t.dataAttributionsTitle}</h2>
          <p role="status">
            {unavailable
              ? t.dataAttributionsUnavailable
              : sources === null
                ? t.dataAttributionsLoading
                : t.dataAttributionsEmpty}
          </p>
        </section>
      )}
      <TransportAttributions
        locale={locale}
        sources={supplementaryGtfsLicenses.filter(
          (source) =>
            !sources?.some((active) => active.feed_id === source.feed_id),
        )}
        title={t.dataSupplementaryGtfsTitle}
        headingId="supplementary-gtfs-title"
      />
      <p className="license-supplementary-note">
        {t.dataSupplementaryGtfsScope}
      </p>
      <TransportAttributions
        locale={locale}
        sources={supplementaryDataLicenses}
        title={t.dataSupplementaryTitle}
        headingId="supplementary-attributions-title"
      />
      <p className="license-supplementary-note">{t.dataSupplementaryScope}</p>
    </>
  );
}
