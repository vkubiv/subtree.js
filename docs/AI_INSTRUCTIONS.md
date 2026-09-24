# Architecture guide for apps built on subtree.js

Copy this file into your app as `CLAUDE.md` (or a section of it) and adjust the
"Status" and "Reference implementation" lines. It is the operating manual for anyone,
human or agent, adding a feature to an app built on `subtree.js`, `trunk.js` and
`operation-result.js`. The full description with rationale is
[`ARCHITECTURE.md`](./ARCHITECTURE.md); library references are
[`subtree.md`](./subtree.md), [`operation-result.md`](./operation-result.md) and the
[`trunk.js` README](../packages/trunk/README.md); worked examples are
[`examples/login`](../examples/login) and [`examples/notes`](../examples/notes).

## Status

_Fill in: is this the architecture of the whole app, or of new and refactored code only?
Which flow is the reference implementation to copy?_

## The app in one paragraph

Two layers plus a client for the backend. The **core layer** (`src/core/`) has no React:
repositories store state and notify, ops hold the business logic, services run things
over time, the session lives in `LoggedinUser` and `AuthHandler`. The **UI layer**
(`src/flows/`) is flows, pages and sections built on `subtree.js`: a page is a model
(state + actions), a controller and a view; a flow wires pages to routes. The
**backend-client** returns `Result<T, E>` for every expected failure. Dependencies are
plain objects narrowed by `Pick` and `pick()`; navigation is a `Routing` object of
callbacks; expected failures are values and unexpected ones are thrown.

## Directory structure

```
src/
  core/
    primitives/     value objects, enums, validators
    repositories/   ChangeNotifier state holders, <Feature>Repository. No logic.
    ops/            business logic: exported functions, one module per feature
    services/       long-lived stateful objects (pollers, sockets)
    auth/           LoggedinUser, AuthStorage, PendingReauth, flow-state objects
  flows/
    <flow>/
      <flow>-flow.tsx           routes + Routing wiring + per-flow state
      pages/<page>/
        <page>-model.ts         State class (Rx fields) + Actions abstract class
        <page>-controller.ts    Deps type, Routing type, Controller
        <page>-page.tsx         React view
        <page>-controller.test.ts, <page>-page.test.tsx
      sections/<section>/       nested BaseController + model + view (optional)
  app-deps.ts       AppDeps interface + createAppDeps()
  app.tsx           root routes
backend-client/     separate package (or src/backend-client/): transport, API groups, models
```

## Core layer rules

**Repositories** extend `ChangeNotifier`, expose getters, mutate through methods that
call `notifyListeners()`, and contain no logic. Prefer a discriminated union for
load state: `{ kind: "idle" } | { kind: "loading" } | { kind: "loaded"; ... }`.

**Ops** are exported functions. Every dependency is a named field of one options
argument, so call sites read like documentation and tests pass fakes:

```ts
export async function loadProfile(o: {
  userApi: UserApi;
  authHandler: AuthHandler<ApiContext>;
  profileRepository: ProfileRepository;
}): Promise<void> {
  o.profileRepository.setLoading();
  const r = await o.authHandler.callApi((ctx) => o.userApi.me(ctx));
  if (!r.ok) { o.profileRepository.reset(); return; }
  o.profileRepository.setProfile(r.value);
}
```

Return `AsyncResult<T, E>` when the caller must handle a known failure, `Promise<void>`
for best-effort work that reports through a repository. Only ops mutate repositories.

**Session.** `LoggedinUser extends ChangeNotifier` implements
`AuthContextProvider<ApiContext>`; `AuthHandler.callApi(ctx => api.x(ctx))` injects the
context and, on `ApiNotAuthorized`, hands a `PendingCall` to `onAuthFailure`. Keep parked
calls in a `PendingReauth` repository; the re-auth page calls `retryAll()` or
`cancelAll()`. Use `loggedinUser.authorizeCall()` directly only for background work
that handles a 401 itself.

## UI layer rules

**Model.** State is a class of `Rx` fields; `Actions` is an abstract class (it doubles
as the runtime token).

```ts
export class OtpState {
  readonly otp = new Rx("");
  readonly isLoading = new Rx(false);
  readonly errorMessage = new Rx<string | null>(null);
}
export abstract class OtpActions {
  abstract onOtpChanged(value: string): void;
  abstract submit(): Promise<void>;
}
```

**Controller.** Three declarations per page: `Deps` (a `Pick` of the flow's deps, plus
explicit per-flow objects), `Routing` (callbacks), `Controller`.

```ts
export type OtpDeps = Pick<SignInFlowDeps, "authApi" | "loggedinUser"> & { signingInUser: SigningInUser };
export interface OtpRouting { onSignedIn(): void; onBack(): void }

export class OtpController extends SubtreeController implements OtpActions {
  readonly state = new OtpState();
  constructor(readonly deps: OtpDeps, readonly routing: OtpRouting) {
    super();
    this.subtree.put(OtpState, this.state);
    this.subtree.put(OtpActions, this);
    this.sync(() => { /* mirror a repository into state */ }, [deps.someRepository]);
  }
  onOtpChanged = (value: string) => { this.state.otp.value = value; };
  submit = async () => {
    if (this.state.isLoading.value) return;
    this.state.isLoading.value = true;
    try {
      const r = await verifyOtp({ otp: this.state.otp.value, ...this.deps });
      if (!r.ok) { this.state.errorMessage.value = hasError(r, InvalidOtp) ? "Wrong code" : "Try again"; return; }
      this.routing.onSignedIn();
    } finally {
      this.state.isLoading.value = false;
    }
  };
}
```

Rules:
- Register `state` and the `Actions` implementation in the constructor.
- No business logic: call ops. Observe repositories with `sync` (now and on change) or
  `subscribe` (on change only). Never mutate a repository from a controller.
- Navigate only through `routing.*`. After an `await`, check `this.isDisposed` before
  navigating if the page may have gone away.
- Actions are arrow properties, so views can pass them as bare callbacks.
- Timers, sockets and other handles go through `autoDispose`; child section controllers
  through `own(child)`.
- Derived state: `new ReactiveBlock((ref) => { state.canSubmit.value = ... })`, disposed
  with `autoDispose`.

**View.** Resolve with `useSubtree(Token)`, read with `observer.watch(rx)`, act through
actions. `useSubtree` returns `View<S>`: reactive fields have no `.value`, so a view
cannot read or write state directly and the compiler enforces it.

```tsx
export function OtpPage() {
  const state = useSubtree(OtpState);
  const actions = useSubtree(OtpActions);
  const observer = useObserver();
  return (
    <main>
      <input value={observer.watch(state.otp)} onChange={(e) => actions.onOtpChanged(e.target.value)} />
      <Obs>{(ref) => <button disabled={ref.watch(state.isLoading)} onClick={actions.submit}>Continue</button>}</Obs>
    </main>
  );
}
```

- `useObserver()` once per component; `<Obs>` for a re-render island inside a large view.
- `useRxEvent(state.someEvent, handler)` for one-shot signals (toasts).
- `ref.disableUntilCompleted(actions.save)` guards double submits from the view.
- Views never touch repositories, ops or the router.

**Sections.** A big page is split into sections: `class TopBarController extends
BaseController` takes the page's `subtree` in its constructor and `put`s its own state
and actions there; the page controller creates it with `this.own(new TopBarController(this.subtree, deps))`.

**Flows.** A flow component renders `<Routes>`; each page is a `<Subtree>` whose factory
receives `pick(deps, ...)` and a routing object built from `useNavigate`.

```tsx
<Route index element={
  <Subtree key="national-id" controller={() => new NationalIdController(pick(deps, "recaptcha"), { onOtpRequested: () => navigate("otp") })}>
    <NationalIdPage />
  </Subtree>} />
```

- **Every route's `<Subtree>` gets a `key`.** Sibling routes render at the same tree
  position and React would otherwise keep the previous route's controller.
- Route params are read once by a small route component and passed to the controller;
  the same route for another entity gets a fresh controller through `deps={[id]}`. The
  page never calls `useParams`.
- Per-flow objects (`signingInUser`) live in the flow (`useState`) and are passed
  explicitly to the pages that need them.
- Modals are sections or child `<Subtree>`s, not routes, unless deep-linkable.

**Dependencies.** `AppDeps` is one interface; a flow declares `Pick<AppDeps, ...>`; a
page declares `Pick<FlowDeps, ...> & { explicitExtra }`. `pick()` from `trunk.js` narrows
at runtime at each boundary. No container.

## Results

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };
async function login(...): AsyncResult<Session, InvalidCredentials | EmailNotConfirmed>
```

- Declare expected failures in the return type as a union of error classes (extend
  `AppError` from `trunk.js`). Throw everything unexpected.
- Handle in a controller: check the errors that change the UI with `hasError`, treat the
  rest generically, `return` early, then read `value`.
- Translate at the boundary with `forward(r, mapValue, mapError)`; the mapper must return
  a member of the declared union.
- `AsyncResult` is already a `Promise`. Never wrap it.
- `ApiNotAuthorized` comes from `trunk.js`; the transport maps a 401 to it and
  `AuthHandler` recognises it.

## Testing

| Level | Setup | Asserts |
|---|---|---|
| Ops | Real repositories, fake API returning `ok`/`fail`. No React. | Repository state, returned `Result`. |
| Controller | `new XController(fakeDeps, { onDone: vi.fn() })`; drive actions. No React. | `state.x.value`, routing spies. |
| Page | `render(<SubtreeProvider model={model}>...)` with a real state and mocked actions. | DOM after `act(() => { state.x.value = ... })`; action mocks after events. |
| Flow | The app in a `MemoryRouter` with real deps, StrictMode on. | The DOM through a whole scenario. |

Flow tests: after `await screen.findByRole("heading", ...)`, run `await act(flush)` before
typing (StrictMode replaces the first controller from an effect), and wrap `fireEvent`
in `act` so controller writes reach the DOM synchronously. `sync` runs its first pass
in a microtask: `await flush()` (a `setTimeout(0)`) before asserting on mirrored state.

## Adding a feature ("Appointments")

1. `core/primitives`: value objects, validators.
2. `core/repositories/appointments-repository.ts`: `ChangeNotifier`, getters, mutators.
3. `core/ops/appointment-ops.ts`: functions taking `{ repository, api, authHandler }`,
   returning `AsyncResult` for expected errors. Tests with fakes.
4. Add the repository (and any API group or service) to `AppDeps` and `createAppDeps()`.
5. `flows/appointments/`: flow component; per page a model, a controller (`Deps`,
   `Routing`) and a page; `key` on each route's `<Subtree>`.
6. Tests: controller, page, and the flow scenario.

## Do not

- Do not read or write `.value` in a view (it does not compile) or subscribe manually;
  `observer.watch` is the only read.
- Do not put logic in repositories or controllers. Ops decide.
- Do not import the router in a controller, or `useParams` in a page.
- Do not mutate `Rx` values in place: replace (`rx.update(v => ({ ...v, a }))`).
- Do not use auto-tracking signal libraries next to `Rx`; one model.
- Do not throw expected failures or return `Result` for unexpected ones.
- Do not build a dependency container; `Pick` and `pick()` are enough.
