import type { Listenable, Listener } from "./listenable";
import { SubtreeModel } from "./model";

export interface Disposable {
  dispose(): void;
}

/** A `sync` or `subscribe` registration. `cancel()` stops it early. */
export class Subscription {
  #on: readonly Listenable[];
  #listener: Listener;
  #active = true;

  /** Resolves when the first run of a `sync` finished. Resolved immediately for `subscribe`. */
  readonly ready: Promise<void>;

  constructor(on: readonly Listenable[], listener: Listener, ready: Promise<void>) {
    this.#on = on;
    this.#listener = listener;
    this.ready = ready;
    for (const source of on) source.addListener(listener);
  }

  get active(): boolean {
    return this.#active;
  }

  cancel(): void {
    if (!this.#active) return;
    this.#active = false;
    for (const source of this.#on) source.removeListener(this.#listener);
  }
}

/**
 * Lifecycle for a controller without its own `SubtreeModel`: sections of a page
 * that register into the parent's model. Provides `sync`, `subscribe`,
 * `autoDispose`, `own` and `dispose`.
 */
export class BaseController implements Disposable {
  readonly #subscriptions: Subscription[] = [];
  readonly #disposers: Array<() => void> = [];
  #disposed = false;

  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Run `fn` now and again whenever any of `on` notifies. For mirroring
   * repositories into state and for initial loads.
   *
   * Errors thrown by later runs are not swallowed: they surface as unhandled
   * rejections, which is where a crash reporter sees them.
   */
  sync(fn: () => void | Promise<void>, on: readonly Listenable[]): Subscription {
    this.#assertAlive("sync");
    const listener: Listener = () => {
      if (this.#disposed) return;
      void fn();
    };
    const ready = Promise.resolve().then(() => fn());
    const sub = new Subscription(on, listener, ready);
    this.#subscriptions.push(sub);
    return sub;
  }

  /** Run `fn` only when any of `on` notifies (never immediately). For side effects. */
  subscribe(fn: () => void | Promise<void>, on: readonly Listenable[]): Subscription {
    this.#assertAlive("subscribe");
    const listener: Listener = () => {
      if (this.#disposed) return;
      void fn();
    };
    const sub = new Subscription(on, listener, Promise.resolve());
    this.#subscriptions.push(sub);
    return sub;
  }

  /** Register cleanup callbacks that run on `dispose`, in reverse registration order. */
  autoDispose(cleanup: (() => void) | ReadonlyArray<() => void>): void {
    this.#assertAlive("autoDispose");
    if (typeof cleanup === "function") this.#disposers.push(cleanup);
    else this.#disposers.push(...cleanup);
  }

  /** Take ownership of a child (a section controller, a service handle): it is disposed with this one. */
  own<C extends Disposable>(child: C): C {
    this.autoDispose(() => child.dispose());
    return child;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const sub of this.#subscriptions) sub.cancel();
    this.#subscriptions.length = 0;
    for (let i = this.#disposers.length - 1; i >= 0; i--) {
      this.#disposers[i]?.();
    }
    this.#disposers.length = 0;
  }

  #assertAlive(what: string): void {
    if (this.#disposed) {
      throw new Error(`${this.constructor.name}.${what}() called after dispose()`);
    }
  }
}

/**
 * The controller of a page. Owns a `SubtreeModel` into which it `put`s its state
 * and its actions implementation; `<Subtree>` provides that model to the page.
 */
export class SubtreeController extends BaseController {
  readonly subtree = new SubtreeModel();
}
