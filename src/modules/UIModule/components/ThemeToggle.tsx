import "../styles/theme-toggle.css";
import { useTheme } from "../hooks/useTheme";
import cs from "../locales/cs.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
export default function ThemeToggle({ locale }: { locale: string }) {
  const { dark, ready, toggle } = useTheme();
  const dictionaries = { cs, en, de };
  const label =
    dictionaries[locale as keyof typeof dictionaries]?.themeToggle ??
    cs.themeToggle;
  if (!ready) return null;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={toggle}
    >
      <svg
        className="theme-sun"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </svg>
      <svg
        className="theme-moon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M20 14a8.5 8.5 0 0 1-10-10A8.5 8.5 0 1 0 20 14Z" />
      </svg>
    </button>
  );
}
