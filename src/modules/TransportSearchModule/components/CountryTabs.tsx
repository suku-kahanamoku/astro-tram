import type { CountryCoverage } from "../../TransportCoreModule/types";
import type { Dictionary } from "../../TransportCoreModule/providers/translations";

export default function CountryTabs({
  value,
  countries,
  loading,
  t,
  onChange,
}: {
  value: string;
  countries: CountryCoverage[];
  loading: boolean;
  t: Dictionary;
  onChange: (country: string) => void;
}) {
  const labels: Record<string, string> = {
    CZ: t.cz,
    SK: t.sk,
    AT: t.at,
    PL: t.pl,
    NO: t.no,
  };
  const codes = [
    ...new Set([
      "CZ",
      "SK",
      "AT",
      "PL",
      ...countries.map((c) => c.state),
      value,
    ]),
  ];
  const available = (code: string) =>
    !loading && countries.some((c) => c.state === code && c.searchAvailable);
  return (
    <div className="country-tabs" role="tablist" aria-label={t.country}>
      {codes.map((code) => {
        const enabled = available(code);
        const selected = value === code;
        return (
          <button
            key={code}
            type="button"
            role="tab"
            id={`country-${code.toLowerCase()}`}
            aria-selected={selected}
            aria-controls={
              selected ? `country-search-${code.toLowerCase()}` : undefined
            }
            disabled={!enabled}
            title={!loading && !enabled ? t.countryUnavailable : undefined}
            tabIndex={
              enabled &&
              (selected ||
                (!available(value) && code === codes.find(available)))
                ? 0
                : -1
            }
            onClick={() => onChange(code)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              const choices = codes.filter(available);
              const index = choices.indexOf(code);
              const next =
                e.key === "Home"
                  ? choices[0]
                  : e.key === "End"
                    ? choices.at(-1)
                    : choices[
                        (index +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          choices.length) %
                          choices.length
                      ];
              if (!next) return;
              e.preventDefault();
              onChange(next);
              document.getElementById(`country-${next.toLowerCase()}`)?.focus();
            }}
          >
            <span aria-hidden="true">
              {String.fromCodePoint(
                ...[...code].map((c) => 127397 + c.charCodeAt(0)),
              )}
            </span>
            {labels[code] ?? code}
          </button>
        );
      })}
    </div>
  );
}
