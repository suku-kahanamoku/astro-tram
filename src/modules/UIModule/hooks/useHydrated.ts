import { useEffect, useState } from "react";
/** Gate controls whose default browser action would race with React hydration. */
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
