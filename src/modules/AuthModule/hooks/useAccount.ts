import { useEffect, useState } from "react";
import { ApiError } from "../../CoreModule/providers/api";
import { authProvider } from "../providers/auth";
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
        const user = await authProvider.me(controller.signal);
        if (!user) throw new Error("unavailable");
        if (!controller.signal.aborted) setUser(user);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401)
          location.replace(loginUrl);
        else setError(true);
      }
    })();
    return () => controller.abort();
  }, [loginUrl]);
  return { user, error, logoutError };
}
