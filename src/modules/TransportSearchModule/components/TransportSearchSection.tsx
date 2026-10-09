import SearchForm from "./SearchForm";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

export default function TransportSearchSection({
  t,
  searchUrl,
  locale,
}: {
  t: Dictionary;
  searchUrl: string;
  locale: string;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
        </div>
      </div>
      <SearchForm t={t} searchUrl={searchUrl} locale={locale} />
    </>
  );
}
