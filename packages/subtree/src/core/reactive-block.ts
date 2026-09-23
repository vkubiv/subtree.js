import type { Listener } from "./listenable";
import { READ, type Watchable } from "./rx";

export interface ReactiveRef {
  /** Read a value and re-run the block when it changes. */
  watch<T>(source: Watchable<T>): T;
}

/**
 * Runs a function now and again whenever any value it `watch`ed changes.
 * The non-React counterpart of an observer: useful in controllers and tests for
 * derived state.
 *
 * ```ts
 * const block = new ReactiveBlock((ref) => {
 *   state.canSubmit.value = ref.watch(state.email) !== "" && ref.watch(state.agreed);
 * });
 * this.autoDispose(() => block.dispose());
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
