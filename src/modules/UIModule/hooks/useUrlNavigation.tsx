import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
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
/** Keep transient UI parameters in React; only persistent parameters reach history. */
export function LocalNavigationProvider({
  parameters,
  children,
}: {
  parameters: readonly string[];
  children: ReactNode;
}) {
  const parent = useUrlNavigation();
  const strip = (url: URL) => {
    const next = new URL(url);
    parameters.forEach((key) => next.searchParams.delete(key));
    return next;
  };
  const base = strip(parent.url).href;
  const [local, setLocal] = useState<{ base: string; values: string }>({
    base,
    values: "",
  });
  const url = new URL(base);
  if (local.base === base)
    new URLSearchParams(local.values).forEach((value, key) =>
      url.searchParams.set(key, value),
    );
  const current = useRef({ parent, base, strip });
  current.current = { parent, base, strip };
  const navigate = useCallback(
    (href: string, replace = false) => {
      const { parent, base, strip } = current.current;
      const next = new URL(href, base);
      const target = strip(next).href;
      const values = new URLSearchParams();
      parameters.forEach((key) => {
        const value = next.searchParams.get(key);
        if (value !== null) values.set(key, value);
      });
      if (target !== base) {
        setLocal({ base: target, values: values.toString() });
        parent.navigate(target, replace);
        return;
      }
      setLocal({ base, values: values.toString() });
    },
    [parameters],
  );
  return (
    <Context.Provider value={{ url, navigate }}>{children}</Context.Provider>
  );
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
