import { useRef, type ReactNode } from "react";
import { useNavigation } from "../hooks/useNavigation";
import { useHeaderOffset } from "../hooks/useHeaderOffset";
import ThemeToggle from "./ThemeToggle";
import type { NavigationItem } from "../types";
interface Props {
  locale: string;
  label: string;
  items: NavigationItem[];
  mobileItems?: NavigationItem[];
  menuId?: string;
  openLabel?: string;
  closeLabel?: string;
  framed?: boolean;
  showAction?: boolean;
  brand?: ReactNode;
  language?: ReactNode;
  action?: ReactNode;
}
export default function MainMenu({
  locale,
  label,
  items,
  mobileItems = items,
  menuId = "mobile-navigation",
  openLabel = label,
  closeLabel = label,
  framed = false,
  showAction = true,
  brand,
  language,
  action,
}: Props) {
  const header = useRef<HTMLElement>(null);
  useHeaderOffset(header);
  const { open, setOpen, toggle, menu } = useNavigation();
  const links = (rows: NavigationItem[]) =>
    rows.map((i, n) => (
      <a
        key={n}
        className={`nav-link ${i.current ? "active" : ""}`}
        href={i.href}
        aria-current={i.current ? "page" : undefined}
      >
        {i.label}
      </a>
    ));
  return (
    <header
      ref={header}
      className={`main-menu site-header ${framed ? "main-menu-framed" : ""}`}
      data-main-menu
    >
      <div className="header-inner">
        <div className="header-brand">{brand}</div>
        <nav className="desktop-nav" aria-label={label}>
          {links(items)}
        </nav>
        <div className="header-actions">
          <div className="header-preferences">
            <ThemeToggle locale={locale} />
            {language}
          </div>
          {showAction && action && (
            <div className="header-primary-action">{action}</div>
          )}
          <button
            ref={toggle}
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? closeLabel : openLabel}
            data-menu-toggle
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      <nav
        ref={menu}
        id={menuId}
        className="mobile-nav"
        aria-label={label}
        hidden={!open}
        onClick={(e) => {
          if ((e.target as Element).closest("a")) setOpen(false);
        }}
      >
        {links(mobileItems)}
      </nav>
    </header>
  );
}
