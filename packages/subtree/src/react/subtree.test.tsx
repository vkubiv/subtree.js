import { act, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { describe, expect, it } from "vitest";
import { SubtreeController } from "../core/controller";
import { SubtreeModel } from "../core/model";
import { Rx } from "../core/rx";
import { useObserver } from "./observer";
import { Subtree, SubtreeProvider } from "./subtree";
import { useSubtree } from "./use-subtree";

class State {
  readonly label = new Rx("init");
}
abstract class Actions {
  abstract rename(to: string): void;
}

const live: TestController[] = [];

class TestController extends SubtreeController implements Actions {
  readonly state = new State();
  readonly id: number;
  constructor(id: number) {
    super();
    this.id = id;
    this.subtree.put(State, this.state);
    this.subtree.put(Actions, this);
    live.push(this);
  }
  rename = (to: string) => {
    this.state.label.value = to;
  };
}

function Page() {
  const observer = useObserver();
  const state = useSubtree(State);
  const actions = useSubtree(Actions);
  return (
    <div>
      <span data-testid="label">{observer.watch(state.label)}</span>
      <button type="button" onClick={() => actions.rename("renamed")}>
        rename
      </button>
    </div>
  );
}

function visibleController(): TestController {
  const alive = live.filter((c) => !c.isDisposed);
  expect(alive).toHaveLength(1);
  return alive[0]!;
}

describe("<Subtree>", () => {
  it("builds one live controller, provides it, and disposes it on unmount (StrictMode)", () => {
    live.length = 0;
    const { unmount } = render(
      <StrictMode>
        <Subtree controller={() => new TestController(1)}>
          <Page />
        </Subtree>
      </StrictMode>,
    );
    const controller = visibleController();
    expect(screen.getByTestId("label").textContent).toBe("init");

    act(() => screen.getByText("rename").click());
    expect(screen.getByTestId("label").textContent).toBe("renamed");
    expect(controller.state.label.value).toBe("renamed");

    unmount();
    expect(live.every((c) => c.isDisposed)).toBe(true);
  });

  it("keeps the controller across parent re-renders", () => {
    live.length = 0;
    function Parent() {
      const [n, setN] = useState(0);
      return (
        <div>
          <button type="button" onClick={() => setN(n + 1)}>
            bump {n}
          </button>
          <Subtree controller={() => new TestController(2)}>
            <Page />
          </Subtree>
        </div>
      );
    }
    render(
      <StrictMode>
        <Parent />
      </StrictMode>,
    );
    const before = visibleController();
    act(() => screen.getByText(/bump/).click());
    act(() => screen.getByText(/bump/).click());
    const after = visibleController();
    expect(after).toBe(before);
    expect(before.isDisposed).toBe(false);
  });

  it("rebuilds the controller when deps change and disposes the previous one", () => {
    live.length = 0;
    function Parent() {
      const [id, setId] = useState(10);
      return (
        <div>
          <button type="button" onClick={() => setId(id + 1)}>
            next
          </button>
          <Subtree deps={[id]} controller={() => new TestController(id)}>
            <Page />
          </Subtree>
        </div>
      );
    }
    render(
      <StrictMode>
        <Parent />
      </StrictMode>,
    );
    const first = visibleController();
    expect(first.id).toBe(10);
    act(() => screen.getByText("next").click());
    const second = visibleController();
    expect(second.id).toBe(11);
    expect(first.isDisposed).toBe(true);
    expect(screen.getByTestId("label").textContent).toBe("init");
  });

  it("useSubtree throws a helpful error outside a Subtree", () => {
    const orig = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Page />)).toThrow(/outside of a <Subtree>/);
    } finally {
      console.error = orig;
    }
  });
});

describe("<SubtreeProvider>", () => {
  it("renders a page against a hand-made model (test setup)", () => {
    const model = new SubtreeModel();
    const state = model.put(State, new State());
    const renamed: string[] = [];
    model.put(Actions, { rename: (to: string) => renamed.push(to) });

    render(
      <StrictMode>
        <SubtreeProvider model={model}>
          <Page />
        </SubtreeProvider>
      </StrictMode>,
    );
    expect(screen.getByTestId("label").textContent).toBe("init");
    act(() => {
      state.label.value = "from test";
    });
    expect(screen.getByTestId("label").textContent).toBe("from test");
    act(() => screen.getByText("rename").click());
    expect(renamed).toEqual(["renamed"]);
  });
});
