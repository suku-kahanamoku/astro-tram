import { useHydrated } from "../../UIModule/hooks/useHydrated";
import { useDisclosure } from "../../UIModule/hooks/useDisclosure";
export default function LanguagePicker({
  locale,
  label,
  items,
}: {
  locale: string;
  label: string;
  items: { code: string; href: string; flag: string; name: string }[];
}) {
  const { ref, open, setOpen } = useDisclosure();
  const ready = useHydrated();
  const current = items.find((item) => item.code === locale);
  return (
    <details ref={ref} className="language-picker" open={open}>
      <summary
        aria-disabled={!ready}
        tabIndex={ready ? 0 : -1}
        style={{ pointerEvents: ready ? undefined : "none" }}
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        aria-label={`${label}: ${locale === "cs" ? "CZ" : locale.toUpperCase()}`}
      >
        <span className="language-current">
          <img
            className="language-flag"
            src={current?.flag}
            width={27}
            height={18}
            alt=""
          />
        </span>
        <svg
          className="disclosure-chevron language-chevron"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>
      <div className="language-options">
        {items.map((item) => (
          <a
            key={item.code}
            href={item.href}
            lang={item.code}
            hrefLang={item.code}
            aria-current={item.code === locale ? "true" : undefined}
            aria-label={item.name}
            title={item.name}
          >
            <img
              className="language-flag"
              src={item.flag}
              width={27}
              height={18}
              alt=""
            />
          </a>
        ))}
      </div>
    </details>
  );
}
