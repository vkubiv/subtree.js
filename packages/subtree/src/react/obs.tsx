import type { ReactNode } from "react";
import { type ObserverRef, useObserver } from "./observer";

export interface ObsProps {
  children: (ref: ObserverRef) => ReactNode;
}

/**
 * A re-render island. Only this component re-renders when a value it watched
 * changes, so a large page can keep its reactive parts small.
 *
 * ```tsx
 * <Obs>{(ref) => <Badge>{ref.watch(state.count)}</Badge>}</Obs>
 * ```
 */
export function Obs({ children }: ObsProps) {
  const ref = useObserver();
  return <>{children(ref)}</>;
}
