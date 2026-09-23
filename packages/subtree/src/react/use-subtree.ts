import { useContext } from "react";
import type { Token } from "../core/model";
import type { View } from "../core/rx";
import { SubtreeModelContext } from "./context";

/**
 * Resolve state or actions from the nearest `<Subtree>` / `<SubtreeProvider>`.
 *
 * The result is typed as `View<T>`: every `Rx` field is a `Watchable` with no
 * `.value`, so a view can only read state through `observer.watch(...)`.
 * Functions (the actions) pass through unchanged.
 */
export function useSubtree<T>(token: Token<T>): View<T> {
  const model = useContext(SubtreeModelContext);
  if (model === null) {
    throw new Error(
      "useSubtree() was called outside of a <Subtree>. Wrap the page in <Subtree controller={...}>.",
    );
  }
  return model.get(token) as View<T>;
}
