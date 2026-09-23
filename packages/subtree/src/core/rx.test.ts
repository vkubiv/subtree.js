import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { ChangeNotifier } from "./listenable";
import { READ, Rx, RxEvent, RxList, readWatchable, type View, type Watchable, watchable } from "./rx";

describe("ChangeNotifier", () => {
  class Repo extends ChangeNotifier {
    n = 0;
    bump() {
      this.n++;
      this.notifyListeners();
    }
  }

  it("notifies every listener in order and reports hasListeners", () => {
    const repo = new Repo();
    const calls: string[] = [];
    repo.addListener(() => calls.push("a"));
    repo.addListener(() => calls.push("b"));
    expect(repo.hasListeners).toBe(true);
    repo.bump();
    expect(calls).toEqual(["a", "b"]);
  });

  it("a listener may remove itself while being notified", () => {
    const repo = new Repo();
    const once = vi.fn(() => repo.removeListener(once));
    const always = vi.fn();
    repo.addListener(once);
    repo.addListener(always);
    repo.bump();
    repo.bump();
    expect(once).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(2);
  });

  it("dispose drops listeners", () => {
    const repo = new Repo();
    const l = vi.fn();
    repo.addListener(l);
    repo.dispose();
    repo.bump();
    expect(l).not.toHaveBeenCalled();
    expect(repo.hasListeners).toBe(false);
  });
});

describe("Rx", () => {
  it("reads and writes value, notifying only on change", () => {
    const rx = new Rx(1);
    const l = vi.fn();
    rx.addListener(l);
    rx.value = 1;
    expect(l).not.toHaveBeenCalled();
    rx.value = 2;
    expect(l).toHaveBeenCalledTimes(1);
    expect(rx.value).toBe(2);
  });

  it("update derives from the current value", () => {
    const rx = new Rx({ a: 1 });
    const l = vi.fn();
    rx.addListener(l);
    rx.update((v) => ({ ...v, a: 2 }));
    expect(rx.value).toEqual({ a: 2 });
    expect(l).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom equality", () => {
    const rx = new Rx({ id: 1 }, (a, b) => a.id === b.id);
    const l = vi.fn();
    rx.addListener(l);
    rx.value = { id: 1 };
    expect(l).not.toHaveBeenCalled();
    rx.value = { id: 2 };
    expect(l).toHaveBeenCalledTimes(1);
  });

  it("treats NaN as equal and falsy values as real values", () => {
    const rx = new Rx<number | null>(Number.NaN);
    const l = vi.fn();
    rx.addListener(l);
    rx.value = Number.NaN;
    expect(l).not.toHaveBeenCalled();
    rx.value = 0;
    rx.value = null;
    expect(l).toHaveBeenCalledTimes(2);
    expect(rx.value).toBeNull();
  });

  it("is watchable: READ returns the current value", () => {
    const rx = new Rx("a");
    expect(readWatchable(rx)).toBe("a");
    rx.value = "b";
    expect(rx[READ]()).toBe("b");
  });

  it("throws on string coercion", () => {
    const rx = new Rx(1);
    expect(() => `${rx}`).toThrow(/Rx is not a string/);
  });
});

describe("RxList", () => {
  it("stores a frozen copy and notifies on element-wise change only", () => {
    const list = new RxList([1, 2]);
    const l = vi.fn();
    list.addListener(l);
    expect(Object.isFrozen(list.value)).toBe(true);
    list.value = [1, 2];
    expect(l).not.toHaveBeenCalled();
    list.value = [1, 2, 3];
    expect(l).toHaveBeenCalledTimes(1);
    expect(list.value).toEqual([1, 2, 3]);
  });

  it("defaults to an empty list and supports update", () => {
    const list = new RxList<string>();
    expect(list.value).toEqual([]);
    list.update((v) => [...v, "x"]);
    expect(list.value).toEqual(["x"]);
    expect(Object.isFrozen(list.value)).toBe(true);
  });

  it("does not let the caller mutate through the stored reference", () => {
    const input = ["a"];
    const list = new RxList(input);
    input.push("b");
    expect(list.value).toEqual(["a"]);
    expect(() => (list.value as string[]).push("c")).toThrow();
  });
});

describe("RxEvent", () => {
  it("always notifies, even for an equal payload, and keeps the last one", () => {
    const ev = new RxEvent<string>();
    const l = vi.fn();
    ev.addListener(l);
    expect(ev.value).toBeUndefined();
    ev.emit("go");
    ev.emit("go");
    expect(l).toHaveBeenCalledTimes(2);
    expect(ev.value).toBe("go");
    expect(readWatchable(ev)).toBe("go");
  });

  it("supports void payloads", () => {
    const ev = new RxEvent();
    const l = vi.fn();
    ev.addListener(l);
    ev.emit();
    expect(l).toHaveBeenCalledTimes(1);
  });
});

describe("watchable adapter", () => {
  it("adapts a ValueListenable", () => {
    class Counter extends ChangeNotifier {
      #v = 0;
      get value() {
        return this.#v;
      }
      inc() {
        this.#v++;
        this.notifyListeners();
      }
    }
    const c = new Counter();
    const w = watchable(c);
    const l = vi.fn();
    w.addListener(l);
    c.inc();
    expect(l).toHaveBeenCalledTimes(1);
    expect(readWatchable(w)).toBe(1);
    w.removeListener(l);
    c.inc();
    expect(l).toHaveBeenCalledTimes(1);
  });
});

describe("View<S> type", () => {
  class State {
    readonly name = new Rx("a");
    readonly items = new RxList<number>();
    readonly saved = new RxEvent<string>();
    readonly nested = { flag: new Rx(false), label: "x" };
    readonly limit = 3;
    helper() {
      return 1;
    }
  }

  it("turns every reactive field into a Watchable and hides .value", () => {
    const view = new State() as unknown as View<State>;
    expectTypeOf(view.name).toEqualTypeOf<Watchable<string>>();
    expectTypeOf(view.items).toEqualTypeOf<Watchable<readonly number[]>>();
    expectTypeOf(view.saved).toEqualTypeOf<Watchable<string | undefined>>();
    expectTypeOf(view.nested.flag).toEqualTypeOf<Watchable<boolean>>();
    expectTypeOf(view.nested.label).toEqualTypeOf<string>();
    expectTypeOf(view.limit).toEqualTypeOf<number>();
    expectTypeOf(view.helper).toEqualTypeOf<() => number>();
    // Type-only: never executed, only checked.
    const _forbidden = () => {
      // @ts-expect-error: views cannot read .value
      view.name.value;
      // @ts-expect-error: views cannot write .value
      view.name.value = "b";
      // @ts-expect-error: views cannot call update
      view.name.update;
    };
    expect(readWatchable(view.name)).toBe("a");
  });

  it("an Rx is assignable to Watchable, so controllers can pass their fields to views", () => {
    const rx = new Rx(1);
    const w: Watchable<number> = rx;
    expect(readWatchable(w)).toBe(1);
  });
});
