import Icon from "../../UIModule/components/TransitIcon";
import type { Locale } from "../../LangModule/config";
import type { DataAttribution } from "../../TransportCoreModule/types";
import { dictionary } from "../../TransportCoreModule/providers/translations";
import "../styles/attributions.css";

/** Credits come from the active graph/provider manifest, never from a country preset. */
export default function TransportAttributions({
  locale,
  sources,
  title,
  headingId = "transport-attributions-title",
}: {
  locale: Locale;
  sources: DataAttribution[];
  title?: string;
  headingId?: string;
}) {
  const t = dictionary(locale);
  if (!sources.length) return null;
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  return (
    <section
      className="transport-attributions"
      aria-labelledby={headingId}
      data-transport-attributions
    >
      <h2 id={headingId}>{title ?? t.dataAttributionsTitle}</h2>
      <p className="attribution-processing">{t.dataProcessed}</p>
      <ul className="attribution-sources">
        {sources.map((source) => (
          <li key={source.id} data-attribution-source={source.id}>
            <strong>{source.name}</strong>
            <p className="attribution-text">{source.attribution}</p>
            <div className="attribution-links">
              <a
                href={source.license_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.dataLicense} <Icon name="external" size={14} />
              </a>
              {source.source_url && (
                <a
                  href={source.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.dataSource} <Icon name="external" size={14} />
                </a>
              )}
            </div>
            {(source.published_at || source.updated_at) && (
              <dl className="attribution-dates">
                {source.published_at && (
                  <div>
                    <dt>{t.dataPublished}</dt>
                    <dd>
                      <time dateTime={source.published_at}>
                        {date(source.published_at)}
                      </time>
                    </dd>
                  </div>
                )}
                {source.updated_at && (
                  <div>
                    <dt>{t.dataUpdated}</dt>
                    <dd>
                      <time dateTime={source.updated_at}>
                        {date(source.updated_at)}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {source.requirements.length > 0 && (
              <ul className="attribution-requirements">
                {source.requirements.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
