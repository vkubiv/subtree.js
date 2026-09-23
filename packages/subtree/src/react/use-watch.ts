import { useCallback, useSyncExternalStore } from "react";
import { READ, type Watchable } from "../core/rx";

/**
 * Optional shorthand for one value: read it and re-render when it changes.
 * Same mechanism as `useObserver().watch(x)`, without the observer object.
 */
export function useWatch<T>(source: Watchable<T>): T {
  const subscribe = useCallback(
    (onChange: () => void) => {
      source.addListener(onChange);
      return () => source.removeListener(onChange);
    },
    [source],
  );
  return useSyncExternalStore(subscribe, source[READ], source[READ]);
}
