# subtree.js

State management for React that separates **state injection** from **state observation**.
The TypeScript port of the Flutter package [`subtree`](https://github.com/vkubiv/subtree).

- State is a plain class of reactive fields (`Rx`, `RxList`, `RxEvent`).
- Actions are plain methods on an abstract class.
- A controller is a regular class: it `put`s state and actions into its `SubtreeModel`,
  observes repositories with `sync` / `subscribe`, and is disposed with the page.
- A view resolves state and actions with `useSubtree(Token)` and re-renders only for
  what it reads through `observer.watch(x)`. Explicit, no auto-tracking, no transform.

```
npm i subtree.js
```

Entry points: `subtree.js` (everything), `subtree.js/core` (no React: reactive
primitives, controllers, model), `subtree.js/react` (bindings). React 18+ is a peer
dependency of the react entry only.

## Quick start

```ts
// counter-model.ts
import { Rx } from "subtree.js/core";

export class CounterState {
  readonly count = new Rx(0);
}
export abstract class CounterActions {
  abstract increment(): void;
}
```

```ts
// counter-controller.ts
import { SubtreeController } from "subtree.js/core";
import { CounterActions, CounterState } from "./counter-model";

export class CounterController extends SubtreeController implements CounterActions {
  readonly state = new CounterState();

  constructor() {
    super();
    this.subtree.put(CounterState, this.state);
    this.subtree.put(CounterActions, this);
  }

  increment = () => {
    this.state.count.value++;
  };
}
```

```tsx
// counter-page.tsx
import { useObserver, useSubtree } from "subtree.js/react";
import { CounterActions, CounterState } from "./counter-model";

export function CounterPage() {
  const observer = useObserver();
  const state = useSubtree(CounterState);
  const actions = useSubtree(CounterActions);
  return <button onClick={actions.increment}>{observer.watch(state.count)}</button>;
}
```

```tsx
// wherever the page is mounted (a route element, a flow component)
<Subtree controller={() => new CounterController()}>
  <CounterPage />
</Subtree>
```

## Core (`subtree.js/core`)

| | |
|---|---|
| `Rx<T>` | `value` get/set (notifies on change, `Object.is`), `update(fn)`, custom `equals`. |
| `RxList<T>` | `Rx<readonly T[]>` that stores a frozen copy and compares element-wise. |
| `RxEvent<T>` | `emit(payload)` always notifies. For navigation and toasts. |
| `ChangeNotifier` | Base class for repositories and services: `notifyListeners()`, `hasListeners`, `dispose()`. |
| `Listenable`, `ValueListenable<T>` | The interfaces everything above implements. |
| `BaseController` | `sync(fn, on)`, `subscribe(fn, on)`, `autoDispose(fn)`, `own(child)`, `isDisposed`, `dispose()`. For sections that register into a parent's model. |
| `SubtreeController` | `BaseController` plus `subtree: SubtreeModel`. One per page. |
| `SubtreeModel` | `put(Token, instance)` (throws on duplicate), `get(Token)` (throws on miss), `has(Token)`. |
| `token<T>(name)` | A typed symbol token for interfaces without a class. |
| `ReactiveBlock` | Runs a function now and on change of what it `watch`ed. For tests and code outside a controller; a controller derives state with `sync`. |
| `Watchable<T>`, `View<S>` | What views see: an `Rx` without `.value`; a state object with every reactive field mapped. Type-level only. |
| `watchable(vl)`, `readWatchable(w)` | Adapt a foreign `ValueListenable`; read a `Watchable` outside a view. |

### `sync` and `subscribe`

```ts
// Runs now and whenever the repository notifies. `.ready` resolves after the first run.
const sub = this.sync(() => {
  this.state.balance.value = this.deps.balanceRepository.balance;
}, [this.deps.balanceRepository]);
await sub.ready;

// Runs only on change. For side effects.
this.subscribe(() => {
  if (this.state.isSaved.value) this.routing.goBack();
}, [this.state.isSaved]);
```

Both are cancelled on `dispose()`; `sub.cancel()` stops one early. A change that
arrives after `dispose()` never runs the callback.

### Views cannot write state

`useSubtree(State)` returns `View<State>`: each `Rx<T>` field is a `Watchable<T>` with no
`.value` and no `update`. The only read is `observer.watch(...)`; the only writes are
actions. The compiler enforces the rule. Controllers keep the full `Rx`.

## React (`subtree.js/react`)

| | |
|---|---|
| `<Subtree controller={() => ctrl} deps={[id]}>` | Builds on mount, disposes on unmount, rebuilds when `deps` change. Survives parent re-renders and StrictMode. |
| `useSubtree(Token)` | Resolve state or actions from the nearest `Subtree`, typed as `View<T>`. |
| `useObserver()` | `observer.watch(x)` reads and subscribes; `observer.disableUntilCompleted(action)` returns `undefined` while an async action runs. |
| `<Obs>{(ref) => ...}</Obs>` | A re-render island with the same `ref.watch`. |
| `useWatch(x)` | Optional one-value shorthand. |
| `useRxEvent(event, handler)` | Run a side effect on every `emit`. |
| `<SubtreeProvider model={m}>` | Provide a hand-made `SubtreeModel` (tests, stories). |

Nothing subscribes during render. `watch` records what was read; an effect turns the
record into subscriptions and re-renders if a value changed in between.

## Testing

```ts
// controller: no React
const routing = { onSignedIn: vi.fn() };
const c = new OtpController(fakeDeps, routing);
await c.onOtpCompleted("123456");
expect(routing.onSignedIn).toHaveBeenCalled();
c.dispose();
```

```tsx
// view: a real state, a mocked actions object
const model = new SubtreeModel();
const state = model.put(OtpState, new OtpState());
model.put(OtpActions, { onOtpChanged: vi.fn(), onOtpCompleted: vi.fn(), onResend: vi.fn() });
render(<SubtreeProvider model={model}><OtpPage /></SubtreeProvider>);
act(() => { state.countdown.value = 0; });
```

## Architecture

The package is one part of a larger application structure (core layer with
repositories, ops and services; UI layer with flows, pages and sections; typed results;
an auth handler). In the repository:

- [`docs/subtree.md`](https://github.com/vkubiv/subtree.js/blob/master/docs/subtree.md): the full reference of this package.
- [`docs/ARCHITECTURE.md`](https://github.com/vkubiv/subtree.js/blob/master/docs/ARCHITECTURE.md): the architecture; [`docs/AI_INSTRUCTIONS.md`](https://github.com/vkubiv/subtree.js/blob/master/docs/AI_INSTRUCTIONS.md): the condensed manual for an app's `CLAUDE.md`.
- [`examples/login`](https://github.com/vkubiv/subtree.js/tree/master/examples/login) and [`examples/notes`](https://github.com/vkubiv/subtree.js/tree/master/examples/notes): complete apps with tests.
- Companion packages `trunk.js` (`pick`, `AuthHandler`, `AppError`) and `operation-result.js` (`Result<T, E>`).
