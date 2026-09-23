import { useEffect, useRef } from "react";
import { READ, type Watchable } from "../core/rx";

/**
 * Run `handler` every time `event` emits (navigation, toasts, focus). The
 * counterpart of Flutter's `EventListener`. The latest `handler` is always used;
 * no need to memoize it.
 *
 * ```tsx
 * useRxEvent(state.saved, () => navigate(-1));
 * ```
 */
export function useRxEvent<T>(event: Watchable<T>, handler: (payload: T) => void): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const listener = () => latest.current(event[READ]());
    event.addListener(listener);
    return () => event.removeListener(listener);
  }, [event]);
}
