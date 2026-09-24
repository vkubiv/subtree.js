import type { Listener } from "./listenable";
import { READ, type Watchable } from "./rx";

export interface ReactiveRef {
  /** Read a value and re-run the block when it changes. */
  watch<T>(source: Watchable<T>): T;
}

/**
 * Runs a function now and again whenever any value it `watch`ed changes.
 * The non-React counterpart of an observer, for tests and for code that has no
 * controller. Inside a controller, derive state with `sync` over the `Rx`
 * fields instead: it is disposed with the controller and names what it reads.
 *
 * ```ts
 * const block = new ReactiveBlock((ref) => {
 *   seen.push(ref.watch(state.email));
 * });
 * block.dispose();
 * ```
 */
export class ReactiveBlock implements ReactiveRef {
  readonly #fn: (ref: ReactiveRef) => void;
  readonly #watched = new Set<Watchable<unknown>>();
  readonly #rerun: Listener = () => this.#run();
  #disposed = false;

  constructor(fn: (ref: ReactiveRef) => void) {
    this.#fn = fn;
    this.#run();
  }

  #run(): void {
    if (this.#disposed) return;
    this.#fn(this);
  }

  watch<T>(source: Watchable<T>): T {
    if (!this.#watched.has(source)) {
      source.addListener(this.#rerun);
      this.#watched.add(source);
    }
    return source[READ]();
  }

  dispose(): void {
    this.#disposed = true;
    for (const source of this.#watched) {
      source.removeListener(this.#rerun);
    }
    this.#watched.clear();
  }
}
