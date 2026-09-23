import { act, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Rx, RxEvent } from "../core/rx";
import { Obs } from "./obs";
import { useObserver } from "./observer";
import { useRxEvent } from "./use-rx-event";
import { useWatch } from "./use-watch";

const strict = (ui: React.ReactElement) => render(<StrictMode>{ui}</StrictMode>);
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("useObserver", () => {
  it("re-renders on a watched change and ignores unwatched values", () => {
    const watched = new Rx(1);
    const ignored = new Rx(1);
    const renders = vi.fn();
    function C() {
      const o = useObserver();
      renders();
      return <span data-testid="v">{o.watch(watched)}</span>;
    }
    strict(<C />);
    const initial = renders.mock.calls.length;
    act(() => {
      ignored.value = 2;
    });
    expect(renders.mock.calls.length).toBe(initial);
    act(() => {
      watched.value = 2;
    });
    expect(screen.getByTestId("v").textContent).toBe("2");
    expect(renders.mock.calls.length).toBeGreaterThan(initial);
  });

  it("subscribes exactly once per source and unsubscribes on unmount", () => {
    const rx = new Rx(0);
    function C() {
      const o = useObserver();
      return (
        <span>
          {o.watch(rx)}
          {o.watch(rx)}
        </span>
      );
    }
    const { unmount } = strict(<C />);
    expect(rx.hasListeners).toBe(true);
    unmount();
    expect(rx.hasListeners).toBe(false);
  });

  it("follows conditional watches across renders", () => {
    const flag = new Rx(false);
    const detail = new Rx("a");
    function C() {
      const o = useObserver();
      return <span data-testid="v">{o.watch(flag) ? o.watch(detail) : "off"}</span>;
    }
    strict(<C />);
    expect(detail.hasListeners).toBe(false);
    act(() => {
      flag.value = true;
    });
    expect(detail.hasListeners).toBe(true);
    act(() => {
      detail.value = "b";
    });
    expect(screen.getByTestId("v").textContent).toBe("b");
    act(() => {
      flag.value = false;
    });
    expect(detail.hasListeners).toBe(false);
    expect(screen.getByTestId("v").textContent).toBe("off");
  });

  it("disableUntilCompleted returns undefined while the action runs", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => (finish = r)));
    function C() {
      const o = useObserver();
      const save = o.disableUntilCompleted(action);
      return (
        <button type="button" disabled={save === undefined} onClick={save}>
          save
        </button>
      );
    }
    strict(<C />);
    const button = screen.getByText("save") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await act(async () => {
      button.click();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => {
      button.click(); // ignored while disabled
    });
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
      await flush();
    });
    expect(button.disabled).toBe(false);
  });
});

describe("<Obs>", () => {
  it("re-renders only the island", () => {
    const count = new Rx(0);
    const parentRenders = vi.fn();
    function Page() {
      parentRenders();
      return (
        <div>
          <Obs>{(ref) => <span data-testid="c">{ref.watch(count)}</span>}</Obs>
        </div>
      );
    }
    strict(<Page />);
    const before = parentRenders.mock.calls.length;
    act(() => {
      count.value = 5;
    });
    expect(screen.getByTestId("c").textContent).toBe("5");
    expect(parentRenders.mock.calls.length).toBe(before);
  });
});

describe("useWatch", () => {
  it("reads and follows one value", () => {
    const rx = new Rx("x");
    function C() {
      return <span data-testid="v">{useWatch(rx)}</span>;
    }
    const { unmount } = strict(<C />);
    expect(screen.getByTestId("v").textContent).toBe("x");
    act(() => {
      rx.value = "y";
    });
    expect(screen.getByTestId("v").textContent).toBe("y");
    unmount();
    expect(rx.hasListeners).toBe(false);
  });
});

describe("useRxEvent", () => {
  it("calls the latest handler with the payload and unsubscribes on unmount", () => {
    const saved = new RxEvent<string>();
    const seen: string[] = [];
    function C() {
      const [prefix, setPrefix] = useState("a");
      useRxEvent(saved, (id) => seen.push(`${prefix}:${id}`));
      return (
        <button type="button" onClick={() => setPrefix("b")}>
          switch
        </button>
      );
    }
    const { unmount } = strict(<C />);
    act(() => saved.emit("1"));
    act(() => screen.getByText("switch").click());
    act(() => saved.emit("2"));
    expect(seen).toEqual(["a:1", "b:2"]);
    unmount();
    act(() => saved.emit("3"));
    expect(seen).toEqual(["a:1", "b:2"]);
    expect(saved.hasListeners).toBe(false);
  });
});
