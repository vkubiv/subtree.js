# subtree.js: full reference

Self-contained notes on the `subtree.js` package, so this file (not the source) is what
an app's `CLAUDE.md` can point to. Read next to the UI-layer section of
[`ARCHITECTURE.md`](./ARCHITECTURE.md), which shows how an app wires it into pages,
controllers and flows. The Flutter original is `subtree` (Dart, 0.6).

## What it is

State management for React that separates **state injection** from **state observation**.

- **State** is a plain class of reactive fields (`Rx`, `RxList`, `RxEvent`).
- **Actions** are plain methods on an abstract class.
- **Controllers** are regular classes: no reducers, no events, no code generation.
- A **view** gets state and actions by token from the nearest `<Subtree>` (injection) and
  re-renders only for the values it reads through `observer.watch(x)` (observation).

Everything is built on two interfaces, `Listenable` (`addListener`/`removeListener`) and
`ValueListenable<T>` (plus `value`). `Rx`, `RxList` and `RxEvent` implement them, and
`sync`, `subscribe`, `ReactiveBlock` and the observers accept any `Listenable`. That is
why a core layer's `ChangeNotifier` repositories can be observed directly.

## Entry points

```ts
import { Rx, RxList, RxEvent, ChangeNotifier, SubtreeController, BaseController,
         SubtreeModel, token, ReactiveBlock, watchable, readWatchable } from "subtree.js/core";
import { Subtree, SubtreeProvider, useSubtree, useObserver, Obs, useWatch, useRxEvent } from "subtree.js/react";
// "subtree.js" re-exports both.
```

`subtree.js/core` has no React dependency: use it in the core layer, in controllers and
in Node tests. React 18+ is a peer dependency of the `react` entry only.

## Reactive primitives (`subtree.js/core`)

### `Rx<T>`: a single value

```ts
const title = new Rx("Untitled");
title.value = "New";                    // set; notifies when Object.is(old, new) is false
title.update((v) => v.toUpperCase());   // derive from the current value, then set
const v = title.value;                  // read (controllers and tests)
new Rx(point, (a, b) => a.x === b.x);   // custom equality
```

Replace objects and arrays instead of mutating them: `rx.update((v) => ({ ...v, a }))`.
`${rx}` throws on purpose: read `.value` in a controller or `watch` it in a view.

### `RxList<T>`: a list

An `Rx<readonly T[]>` that stores a frozen copy and notifies when the list differs
element-wise (`Object.is` per element).

```ts
const items = new RxList<string>();
items.value = ["a", "b"];
items.update((list) => [...list, "c"]);
```

### `RxEvent<T>`: a fire-and-forget signal

For one-shot signals (navigation, toasts) that are not persistent state. `emit` always
notifies, even with a payload equal to the previous one. `value` is the last payload,
`undefined` before the first `emit`.

```ts
readonly saved = new RxEvent<void>();
readonly failed = new RxEvent<string>();
this.state.failed.emit("Login or password is incorrect");
```

Most pages do not need it: when the controller can act itself, `subscribe` on an
`Rx<boolean>` is simpler.

### `ChangeNotifier`

Base class for repositories, services and session objects. Subclasses call
`notifyListeners()` after a change. Listeners run synchronously, in registration order,
on a snapshot of the set, so a listener may add or remove listeners while notified.
`hasListeners`; `dispose()` drops every listener.

### `Watchable<T>` and `View<S>`

What a view sees. `Watchable<T>` is an `Rx<T>` with `.value` removed (a `Listenable`
plus a read the bindings use). `View<S>` maps every reactive field of a state class to a
`Watchable`, leaves functions alone, and recurses into plain objects. `useSubtree`
returns `View<S>`, so a view cannot read or write `.value`: the rule "views watch,
actions write" is enforced by the compiler at zero runtime cost. Controllers keep the
full `Rx`.

`watchable(valueListenable)` adapts a foreign `ValueListenable` (a third-party notifier)
so a view can watch it. `readWatchable(w)` reads a `Watchable` outside a view (tests).

### `ReactiveBlock`

Runs a function now and again whenever a value it `watch`ed changes. The non-React
observer, for derived state in controllers and for tests.

```ts
const block = new ReactiveBlock((ref) => {
  this.state.canSubmit.value = ref.watch(this.state.email) !== "" && ref.watch(this.state.agreed);
});
this.autoDispose(() => block.dispose());
```

## Controllers

### `SubtreeController`

The controller of a page. Owns a `subtree: SubtreeModel` into which it `put`s its state
and its actions implementation; `<Subtree>` provides that model to the page.

```ts
export class CounterController extends SubtreeController implements CounterActions {
  readonly state = new CounterState();
  constructor() {
    super();
    this.subtree.put(CounterState, this.state);
    this.subtree.put(CounterActions, this);
  }
  increment = () => { this.state.count.value++; };
}
```

### `BaseController`

The same lifecycle without an own model: for sections of a page that register into the
parent's `subtree`. Both provide:

| Member | What it does |
|---|---|
| `sync(fn, on)` | Runs `fn` now (in a microtask) and again whenever any `Listenable` in `on` notifies. Returns a `Subscription`; `await sub.ready` waits for the first run. |
| `subscribe(fn, on)` | Runs `fn` only when any of `on` notifies. Returns a `Subscription`. |
| `autoDispose(fn \| fns)` | Cleanup callbacks run on `dispose()`, in reverse order. |
| `own(child)` | Registers `child.dispose` and returns the child. For section controllers and service handles. |
| `isDisposed` | True after `dispose()`. Check it after an `await` before navigating. |
| `dispose()` | Cancels every subscription, runs the disposers. `sync`/`subscribe`/`autoDispose` throw afterwards. |

`Subscription`: `cancel()` stops it early; `active`; `ready`.

`sync` versus `subscribe`:

| | `sync` | `subscribe` |
|---|---|---|
| Runs on registration | yes (next microtask) | no |
| Runs on each change | yes | yes |
| Use for | loading and mirroring repositories into state | side effects (navigate, toast) |

```ts
this.sync(() => {
  this.state.balance.value = this.deps.balanceRepository.balance;
}, [this.deps.balanceRepository]);

this.subscribe(() => {
  if (this.state.isSaved.value) this.routing.goBack();
}, [this.state.isSaved]);
```

A change that arrives after `dispose()` never runs the callback. Errors thrown by later
runs surface as unhandled rejections, which is where a crash reporter sees them.

### `SubtreeModel` and tokens

The per-page registry. `put(Token, instance)` throws on a duplicate token; `get(Token)`
throws on a miss; `has(Token)`. A token is a class (concrete or abstract) or a typed
symbol:

```ts
export abstract class CounterActions { abstract increment(): void }   // class as token
export const Clock = token<{ now(): number }>("Clock");                // symbol token for an interface
```

The miss message names the token and hints at the two usual causes: the controller did
not `put` it, or a `<Subtree>` at that position still holds another page's controller
(sibling routes need a `key`; see below).

## React bindings (`subtree.js/react`)

### `<Subtree controller={() => ctrl} deps={[...]}>`

Owns a controller's lifecycle and provides its model to the tree below.

- Builds the controller on first render, disposes it on unmount.
- Rebuilds it when any entry of `deps` changes (`Object.is`), disposing the previous one:
  `deps={[userId]}` for a `/users/:id` route.
- Never disposes on a mere parent re-render.
- Under StrictMode the simulated unmount disposes the controller; the effect notices and
  rebuilds it, so the page keeps working in development.

```tsx
<Subtree key="counter" controller={() => new CounterController(pick(deps, "counterApi"))}>
  <CounterPage />
</Subtree>
```

**Give each route's `<Subtree>` a `key`.** With react-router, sibling routes render their
elements at the same position in the React tree; without a key React reuses the
`<Subtree>` instance, and the next page reads the previous page's model.

### `<SubtreeProvider model={model}>`

Provides a hand-made `SubtreeModel` without a controller. For tests and stories: put a
real state and a mocked actions object, render the page.

### `useSubtree(Token)`

Resolves state or actions from the nearest `<Subtree>` or `<SubtreeProvider>`, typed as
`View<T>`. Throws with a helpful message outside of one.

### `useObserver()` and `<Obs>`

```tsx
const observer = useObserver();          // once per component
observer.watch(state.count);             // read + subscribe this component
<Obs>{(ref) => <Badge>{ref.watch(state.count)}</Badge>}</Obs>   // re-render island
```

Nothing subscribes during render: `watch` records what was read; an effect turns the
record into subscriptions and re-renders if a value changed in between. Explicit and
visible: a reader sees exactly which values a component depends on. There is no
auto-tracking, on purpose.

`ref.disableUntilCompleted(action)` wraps an async action so it cannot run twice at
once. It returns `undefined` while the action is in flight, which disables a button
through `onClick`. The action must be callable without `this` (an arrow property on the
controller).

```tsx
<Obs>{(ref) => {
  const save = ref.disableUntilCompleted(actions.save);
  return <button disabled={save === undefined} onClick={save}>{save ? "Save" : "Saving…"}</button>;
}}</Obs>
```

### `useWatch(x)`

Optional one-value shorthand over `useSyncExternalStore`, for a component that reads a
single value.

### `useRxEvent(event, handler)`

Runs `handler` on every `emit` (navigation, toasts, focus). The latest handler is always
used; no need to memoize it. The counterpart of Flutter's `EventListener`.

```tsx
useRxEvent(state.failed, (message) => setToast(message ?? null));
```

## Full minimal example

```ts
// counter-model.ts
export class CounterState { readonly count = new Rx(0); }
export abstract class CounterActions { abstract increment(): void; }

// counter-controller.ts
export class CounterController extends SubtreeController implements CounterActions {
  readonly state = new CounterState();
  constructor() {
    super();
    this.subtree.put(CounterState, this.state);
    this.subtree.put(CounterActions, this);
  }
  increment = () => { this.state.count.value++; };
}
```

```tsx
// counter-page.tsx
export function CounterPage() {
  const state = useSubtree(CounterState);
  const actions = useSubtree(CounterActions);
  const observer = useObserver();
  return <button onClick={actions.increment}>{observer.watch(state.count)}</button>;
}

// wiring, in a flow's route element
<Subtree key="counter" controller={() => new CounterController()}>
  <CounterPage />
</Subtree>
```

## Choosing a primitive

| Need | Use |
|---|---|
| A value the view watches | `Rx<T>` |
| A list the view watches | `RxList<T>` |
| A one-shot signal (navigate, toast) | `RxEvent<T>` + `useRxEvent`, or `subscribe` on an `Rx<boolean>` |
| Load or mirror repository data now and on change | `sync(fn, [repo])` |
| Side effect only on change | `subscribe(fn, [rx])` |
| Derived state in a controller | `ReactiveBlock` |
| Anything with a handle to release | `autoDispose(() => ...)` |
| A child controller | `own(new SectionController(this.subtree, deps))` |
| Prevent double submit from the view | `ref.disableUntilCompleted(action)` |
| Prevent double submit in the controller | guard on an `Rx<boolean>` |
| Observe a foreign `ValueListenable` in a view | `watchable(vl)` |

## Testing

```ts
// Controller: no React. Fake deps, spy routing, drive actions, assert state.
const routing = { onSignedIn: vi.fn() };
const c = new LoginController(fakeDeps, routing);
c.onUsernameChanged("alice");
await c.submit();
expect(routing.onSignedIn).toHaveBeenCalled();
c.dispose();
```

```tsx
// View: a real state, a mocked actions object, no controller.
const model = new SubtreeModel();
const state = model.put(LoginState, new LoginState());
model.put(LoginActions, { onUsernameChanged: vi.fn(), onPasswordChanged: vi.fn(), submit: vi.fn(async () => {}) });
render(<StrictMode><SubtreeProvider model={model}><LoginPage /></SubtreeProvider></StrictMode>);
act(() => { state.canSubmit.value = true; });
```

```tsx
// Flow: the app in a MemoryRouter with real deps.
render(<StrictMode><MemoryRouter><App deps={deps} /></MemoryRouter></StrictMode>);
await screen.findByRole("heading", { name: "Sign in" });
await act(flush);                                   // let StrictMode replace the first controller
act(() => fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } }));
```

Two timing rules. `sync` runs its first pass in a microtask, so `await flush()` (a
`setTimeout(0)`) before asserting on mirrored state. In flow tests, wait for the page
and then `await act(flush)` before typing: under StrictMode the controller built during
the first render is replaced from an effect, and input sent earlier goes to the
discarded one. Wrap `fireEvent` in an explicit `act` so a controller's writes reach the
DOM before the next step.

## Differences from the Flutter package

| Flutter / Dart | TypeScript / React |
|---|---|
| `ControlledSubtree(subtree:, controller:, deps:)` | `<Subtree controller={} deps={}>children</Subtree>` |
| `context.get<T>()` | `useSubtree(Token)`: the token is the class or a `token<T>()` symbol |
| `Obx((ref) => ...)` | `useObserver()` + `observer.watch(rx)`; `<Obs>{ref => ...}</Obs>` for islands |
| `EventListener` widget | `useRxEvent(event, handler)` |
| `ControllerNotifier` | gone; a repository or an `RxEvent` is the signal |
| `state.x.value` readable in a page | not compilable: `useSubtree` returns `View<S>` |
| `sync` returns a `Future` | returns a `Subscription` with `ready` and `cancel()` |
