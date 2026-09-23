export type Listener = () => void;

/** Anything that can tell listeners "something changed". */
export interface Listenable {
  addListener(listener: Listener): void;
  removeListener(listener: Listener): void;
}

/** A `Listenable` that also carries a current value. */
export interface ValueListenable<T> extends Listenable {
  readonly value: T;
}

/**
 * Base class for anything that notifies listeners: repositories, session objects,
 * `Rx` fields. Subclasses call `notifyListeners()` after a change.
 *
 * Listeners are invoked synchronously, in registration order, on a snapshot of the
 * listener set, so a listener may add or remove listeners (including itself) while
 * being notified.
 */
export class ChangeNotifier implements Listenable {
  #listeners = new Set<Listener>();

  protected notifyListeners(): void {
    if (this.#listeners.size === 0) return;
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }

  get hasListeners(): boolean {
    return this.#listeners.size > 0;
  }

  addListener(listener: Listener): void {
    this.#listeners.add(listener);
  }

  removeListener(listener: Listener): void {
    this.#listeners.delete(listener);
  }

  /** Drops every listener. Call when the owning scope is torn down. */
  dispose(): void {
    this.#listeners.clear();
  }
}
