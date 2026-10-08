import { useEffect, useState } from "react";
import type { User } from "../types";

/** Read the HttpOnly session through the authenticated API after hydration. */
export function useAccount(loginUrl: string) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLogoutError(
      new URLSearchParams(location.search).get("error") === "logout",
    );
    void (async () => {
      try {
        const response = await fetch("/api/auth/me/", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        });
        if (response.status === 401) {
          if (!controller.signal.aborted) location.replace(loginUrl);
          return;
        }
        const payload = await response.json();
        if (!response.ok || payload.success !== true || !payload.data)
          throw new Error("unavailable");
        if (!controller.signal.aborted) setUser(payload.data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [loginUrl]);
  return { user, error, logoutError };
}
