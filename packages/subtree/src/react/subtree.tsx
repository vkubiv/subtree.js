import { type ReactNode, useEffect, useReducer, useRef } from "react";
import type { SubtreeController } from "../core/controller";
import type { SubtreeModel } from "../core/model";
import { SubtreeModelContext } from "./context";

export interface SubtreeProps {
  /** Builds the controller. Called on mount and whenever `deps` change. */
  controller: () => SubtreeController;
  /**
   * Identity of the thing this subtree shows. When any entry changes (`Object.is`),
   * the current controller is disposed and a new one is built: `deps={[userId]}`
   * for a `/users/:id` route.
   */
  deps?: readonly unknown[];
  children: ReactNode;
}

interface Slot {
  controller: SubtreeController;
  deps: readonly unknown[];
}

const NO_DEPS: readonly unknown[] = [];

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/**
 * Owns a controller's lifecycle and provides its `SubtreeModel` to the tree below.
 *
 * - Builds the controller on first render, disposes it on unmount.
 * - Rebuilds it when `deps` change; the previous one is disposed.
 * - Never disposes on a mere parent re-render.
 * - Under React StrictMode the simulated unmount disposes the controller; the
 *   effect notices and rebuilds it, so the page keeps working in development.
 */
export function Subtree({ controller: build, deps = NO_DEPS, children }: SubtreeProps) {
  const slot = useRef<Slot | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  if (slot.current === null || !sameDeps(slot.current.deps, deps)) {
    slot.current = { controller: build(), deps };
  }
  const controller = slot.current.controller;

  // `build` and `deps` are read through the slot on purpose: only a new
  // controller instance should re-run this effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (controller.isDisposed) {
      // StrictMode ran cleanup on this instance and then re-ran the effect.
      slot.current = { controller: build(), deps: slot.current?.deps ?? deps };
      rerender();
      return;
    }
    return () => controller.dispose();
  }, [controller]);

  return <SubtreeModelContext.Provider value={controller.subtree}>{children}</SubtreeModelContext.Provider>;
}

export interface SubtreeProviderProps {
  model: SubtreeModel;
  children: ReactNode;
}

/**
 * Provides a ready-made `SubtreeModel` without a controller. For tests and
 * stories: put a real state and a mocked actions object, render the page.
 */
export function SubtreeProvider({ model, children }: SubtreeProviderProps) {
  return <SubtreeModelContext.Provider value={model}>{children}</SubtreeModelContext.Provider>;
}
