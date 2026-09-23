import { useEffect, useReducer, useState } from "react";
import type { Listener } from "../core/listenable";
import { READ, type Watchable } from "../core/rx";

// biome-ignore lint/suspicious/noExplicitAny: any async action
type AsyncAction<A extends any[]> = (...args: A) => Promise<unknown>;

export interface ObserverRef {
  /** Read a value and re-render this component when it changes. */
  watch<T>(source: Watchable<T>): T;
  /**
   * Wrap an async action so it cannot run twice at once. Returns `undefined`
   * while the action is in flight, which disables a button through `onClick`.
   * The action must be callable without `this` (an arrow property on the controller).
   */
  // biome-ignore lint/suspicious/noExplicitAny: any async action
  disableUntilCompleted<A extends any[]>(action: AsyncAction<A>): ((...args: A) => Promise<void>) | undefined;
}

/**
 * Per-component observer. Nothing subscribes during render: `watch` only records
 * what was read; `commit` (run from an effect) turns the record into
 * subscriptions and re-renders if a value changed between render and effect.
 */
export class Observer implements ObserverRef {
  #pending = new Map<Watchable<unknown>, unknown>();
  readonly #subscribed = new Set<Watchable<unknown>>();
  readonly #running = new Set<unknown>();
  readonly #rerender: Listener;
  #mounted = false;

  constructor(rerender: Listener) {
    this.#rerender = rerender;
  }

  /** Called at the start of every render. */
  beginRender(): void {
    this.#pending = new Map();
  }

  watch<T>(source: Watchable<T>): T {
    const value = source[READ]();
    this.#pending.set(source, value);
    return value;
  }

  // biome-ignore lint/suspicious/noExplicitAny: any async action
  disableUntilCompleted<A extends any[]>(
    action: AsyncAction<A>,
  ): ((...args: A) => Promise<void>) | undefined {
    if (this.#running.has(action)) return undefined;
    return async (...args: A) => {
      this.#running.add(action);
      this.#rerender();
      try {
        await action(...args);
      } finally {
        this.#running.delete(action);
        if (this.#mounted) this.#rerender();
      }
    };
  }

  /** Effect setup: subscribe to what the last render read; catch changes made in between. */
  commit(): void {
    this.#mounted = true;
    for (const source of this.#subscribed) {
      if (!this.#pending.has(source)) {
        source.removeListener(this.#rerender);
        this.#subscribed.delete(source);
      }
    }
    let stale = false;
    for (const [source, seen] of this.#pending) {
      if (!this.#subscribed.has(source)) {
        source.addListener(this.#rerender);
        this.#subscribed.add(source);
      }
      if (!Object.is(source[READ](), seen)) stale = true;
    }
    if (stale) this.#rerender();
  }

  /** Effect cleanup: unsubscribe everything but keep the render record, so a StrictMode re-run can re-commit. */
  release(): void {
    this.#mounted = false;
    for (const source of this.#subscribed) {
      source.removeListener(this.#rerender);
    }
    this.#subscribed.clear();
  }

  get subscribedCount(): number {
    return this.#subscribed.size;
  }
}

/**
 * The view-side observer. Call once per component, then `observer.watch(x)` at
 * every read. Explicit and visible: a reader sees exactly which values the
 * component depends on. This is `Obx((ref) => ref.watch(x))` from Flutter, as a hook.
 *
 * ```tsx
 * const observer = useObserver();
 * const state = useSubtree(OtpState);
 * return <span>{observer.watch(state.countdown)}</span>;
 * ```
 */
export function useObserver(): ObserverRef {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [observer] = useState(() => new Observer(rerender));
  observer.beginRender();
  useEffect(() => {
    observer.commit();
    return () => observer.release();
  });
  return observer;
}
