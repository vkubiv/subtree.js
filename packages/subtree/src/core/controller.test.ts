import { describe, expect, it, vi } from "vitest";
import { BaseController, SubtreeController } from "./controller";
import { ChangeNotifier } from "./listenable";
import { Rx } from "./rx";

class Repo extends ChangeNotifier {
  items: string[] = [];
  set(items: string[]) {
    this.items = items;
    this.notifyListeners();
  }
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("BaseController.sync", () => {
  it("runs immediately and on every change of any source", async () => {
    const repo = new Repo();
    const other = new Rx(0);
    const c = new BaseController();
    const runs = vi.fn();
    const sub = c.sync(runs, [repo, other]);
    await sub.ready;
    expect(runs).toHaveBeenCalledTimes(1);
    repo.set(["a"]);
    other.value = 1;
    expect(runs).toHaveBeenCalledTimes(3);
  });

  it("ready resolves after an async first run; later runs are fire-and-forget", async () => {
    const repo = new Repo();
    const c = new BaseController();
    const state = new Rx<string[]>([]);
    let resolveLoad!: () => void;
    const sub = c.sync(async () => {
      await new Promise<void>((r) => {
        resolveLoad = r;
      });
      state.value = repo.items;
    }, [repo]);
    let done = false;
    void sub.ready.then(() => {
      done = true;
    });
    await tick();
    expect(done).toBe(false);
    resolveLoad();
    await sub.ready;
    expect(done).toBe(true);
  });

  it("cancel stops further runs; dispose cancels everything", async () => {
    const repo = new Repo();
    const c = new BaseController();
    const a = vi.fn();
    const b = vi.fn();
    const subA = c.sync(a, [repo]);
    c.sync(b, [repo]);
    await subA.ready;
    subA.cancel();
    repo.set(["x"]);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    expect(subA.active).toBe(false);
    c.dispose();
    repo.set(["y"]);
    expect(b).toHaveBeenCalledTimes(2);
    expect(repo.hasListeners).toBe(false);
  });

  it("a change arriving after dispose does not run the callback", async () => {
    const repo = new Repo();
    const c = new BaseController();
    const fn = vi.fn();
    await c.sync(fn, [repo]).ready;
    c.dispose();
    repo.set(["z"]);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("BaseController.subscribe", () => {
  it("does not run immediately, only on change", () => {
    const rx = new Rx(false);
    const c = new BaseController();
    const fn = vi.fn();
    c.subscribe(fn, [rx]);
    expect(fn).not.toHaveBeenCalled();
    rx.value = true;
    expect(fn).toHaveBeenCalledTimes(1);
    c.dispose();
    rx.value = false;
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("BaseController lifecycle", () => {
  it("autoDispose runs cleanups in reverse order, once", () => {
    const c = new BaseController();
    const order: string[] = [];
    c.autoDispose(() => order.push("first"));
    c.autoDispose([() => order.push("second"), () => order.push("third")]);
    c.dispose();
    c.dispose();
    expect(order).toEqual(["third", "second", "first"]);
    expect(c.isDisposed).toBe(true);
  });

  it("own disposes children with the parent and returns the child", () => {
    const parent = new BaseController();
    const child = new BaseController();
    const timer = vi.fn();
    child.autoDispose(timer);
    expect(parent.own(child)).toBe(child);
    parent.dispose();
    expect(child.isDisposed).toBe(true);
    expect(timer).toHaveBeenCalledTimes(1);
  });

  it("refuses new registrations after dispose", () => {
    const c = new BaseController();
    c.dispose();
    expect(() => c.sync(() => {}, [])).toThrow(/sync\(\) called after dispose/);
    expect(() => c.subscribe(() => {}, [])).toThrow(/subscribe\(\) called after dispose/);
    expect(() => c.autoDispose(() => {})).toThrow(/autoDispose\(\) called after dispose/);
  });
});

describe("SubtreeController", () => {
  class State {
    readonly n = new Rx(0);
  }
  abstract class Actions {
    abstract inc(): void;
  }
  class Controller extends SubtreeController implements Actions {
    readonly state = new State();
    constructor() {
      super();
      this.subtree.put(State, this.state);
      this.subtree.put(Actions, this);
    }
    inc() {
      this.state.n.value++;
    }
  }

  it("owns a model where state and actions are registered", () => {
    const c = new Controller();
    c.subtree.get(Actions).inc();
    expect(c.subtree.get(State).n.value).toBe(1);
  });
});
