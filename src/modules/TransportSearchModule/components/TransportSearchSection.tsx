import SearchForm from "./SearchForm";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

export default function TransportSearchSection({
  t,
  searchUrl,
}: {
  t: Dictionary;
  searchUrl: string;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.subtitle}</p>
      </div>
      <SearchForm t={t} searchUrl={searchUrl} />
    </>
  );
}
