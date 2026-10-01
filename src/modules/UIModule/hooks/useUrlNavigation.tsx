import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
export interface UrlNavigation {
  url: URL;
  navigate: (href: string, replace?: boolean) => void;
}
const Context = createContext<UrlNavigation | null>(null);
export function UrlNavigationProvider({
  initialUrl,
  children,
}: {
  initialUrl: string;
  children: ReactNode;
}) {
  const [href, setHref] = useState(initialUrl);
  useEffect(() => {
    const update = () => setHref(location.href);
    update();
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((target: string, replace = false) => {
    const next = new URL(target, location.href);
    if (next.origin !== location.origin) {
      location.assign(next);
      return;
    }
    history[replace ? "replaceState" : "pushState"](
      null,
      "",
      next.pathname + next.search + next.hash,
    );
    setHref(next.href);
  }, []);
  const value = useMemo(
    () => ({ url: new URL(href), navigate }),
    [href, navigate],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useUrlNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing UrlNavigationProvider");
  return value;
}
export function NavLink({
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigation = useContext(Context);
  return (
    <a
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (
          !e.defaultPrevented &&
          navigation &&
          props.href &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          (!props.target || props.target === "_self")
        ) {
          e.preventDefault();
          navigation.navigate(props.href);
        }
      }}
    />
  );
}
