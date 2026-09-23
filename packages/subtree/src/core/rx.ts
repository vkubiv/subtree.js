import { ChangeNotifier, type Listenable, type ValueListenable } from "./listenable";

/**
 * The read capability of a reactive value. Views receive `Watchable<T>` (through
 * `useSubtree`, see `View<S>`) and can only read it through `observer.watch(...)`.
 * Controllers hold the full `Rx<T>` and use `.value`.
 *
 * Exported for the react bindings; application code never calls it directly.
 */
export const READ: unique symbol = Symbol("subtree.read");

export interface Watchable<T> extends Listenable {
  readonly [READ]: () => T;
}

/** What a view sees of a state object: every reactive field becomes a `Watchable`. */
export type View<S> = {
  readonly [K in keyof S]: S[K] extends Watchable<infer T>
    ? Watchable<T>
    : // biome-ignore lint/suspicious/noExplicitAny: any function signature passes through
      S[K] extends (...args: any[]) => any
      ? S[K]
      : S[K] extends object
        ? View<S[K]>
        : S[K];
};

export type Equals<T> = (a: T, b: T) => boolean;

/**
 * A single reactive value. Setting `.value` notifies listeners when the new value
 * differs from the old one (`Object.is` by default).
 *
 * ```ts
 * const title = new Rx("Untitled");
 * title.value = "New";                 // notifies
 * title.update((v) => v.toUpperCase()); // derive from current, notifies
 * ```
 */
export class Rx<T> extends ChangeNotifier implements ValueListenable<T>, Watchable<T> {
  #value: T;
  readonly #equals: Equals<T>;

  constructor(value: T, equals: Equals<T> = Object.is) {
    super();
    this.#value = value;
    this.#equals = equals;
  }

  get value(): T {
    return this.#value;
  }

  set value(next: T) {
    if (this.#equals(this.#value, next)) return;
    this.#value = next;
    this.notifyListeners();
  }

  /** Replace the value with one derived from the current one. */
  update(fn: (value: T) => T): void {
    this.value = fn(this.#value);
  }

  readonly [READ] = (): T => this.#value;

  /** Guards against `${rx}` and string concatenation: read the value instead. */
  override toString(): string {
    throw new Error("Rx is not a string: use `.value` in a controller or `observer.watch(rx)` in a view");
  }
}

/**
 * A reactive list. Stores a frozen copy of what it is given and notifies when the
 * new list differs element-wise (`Object.is` per element).
 */
export class RxList<T> extends Rx<readonly T[]> {
  constructor(items: readonly T[] = [], equals: Equals<readonly T[]> = shallowArrayEquals) {
    super(Object.freeze([...items]), equals);
  }

  override get value(): readonly T[] {
    return super.value;
  }

  override set value(next: readonly T[]) {
    super.value = Object.freeze([...next]);
  }
}

export function shallowArrayEquals<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

/**
 * A fire-and-forget signal (navigation, toast). Unlike `Rx`, `emit` always
 * notifies, even with a value equal to the previous one. `value` is the last
 * emitted payload, or `undefined` before the first `emit`.
 */
export class RxEvent<T = void>
  extends ChangeNotifier
  implements ValueListenable<T | undefined>, Watchable<T | undefined>
{
  #last: T | undefined;

  emit(payload: T): void {
    this.#last = payload;
    this.notifyListeners();
  }

  get value(): T | undefined {
    return this.#last;
  }

  readonly [READ] = (): T | undefined => this.#last;

  override toString(): string {
    throw new Error("RxEvent is not a string: subscribe to it with useRxEvent or controller.subscribe");
  }
}

/**
 * Adapts any `ValueListenable` (a repository getter, a third-party notifier) so a
 * view can `watch` it. Rx, RxList and RxEvent are already watchable.
 */
export function watchable<T>(source: ValueListenable<T>): Watchable<T> {
  return {
    addListener: (l) => source.addListener(l),
    removeListener: (l) => source.removeListener(l),
    [READ]: () => source.value,
  };
}

/** Read a watchable outside a view (tests, controllers holding a `Watchable`). */
export function readWatchable<T>(w: Watchable<T>): T {
  return w[READ]();
}
