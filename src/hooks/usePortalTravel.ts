import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldId } from "../data/universe";

/** Routing never depends on animationend, GPU availability or CSS completion. */
export function usePortalTravel(
  navigate: (path: string) => void,
  locationKey: string,
  reduced: boolean,
) {
  const [active, setActive] = useState(false);
  const pending = useRef<WorldId | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);
  const finish = useCallback(() => {
    const id = pending.current;
    if (!id) return;
    cancel();
    setActive(false);
    navigate(id === "hub" ? "/explore" : "/worlds/" + id);
  }, [cancel, navigate]);
  useEffect(() => {
    // Back/forward cancels an interrupted entrance rather than hijacking navigation.
    cancel();
    setActive(false);
    return cancel;
  }, [locationKey, cancel]);
  useEffect(() => {
    if (reduced && pending.current) finish();
  }, [reduced, finish]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) finish();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [finish]);
  const start = useCallback(
    (id: WorldId) => {
      if (pending.current) return false;
      pending.current = id;
      setActive(true);
      timer.current = setTimeout(finish, reduced ? 0 : 950);
      return true;
    },
    [finish, reduced],
  );
  return { active, start };
}
