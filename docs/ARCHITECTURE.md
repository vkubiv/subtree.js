# Subtree architecture for TypeScript / React

This document describes the application architecture that `subtree` enables. It is the
TypeScript/React counterpart of the architecture implemented in Flutter in `btb-neo`
(`CLAUDE.md`, `doc/architecture/*.md`) with the Dart packages `subtree`, `immutable_di`
and `operation_result`. It is written so that a new app (or an AI agent working in one)
can follow it without reading the Flutter sources.

Status: **implemented** by `subtree.js`, `trunk.js` and `operation-result.js` in this
repository, and exercised by [`examples/login`](../examples/login) and
[`examples/notes`](../examples/notes). Companion documents:

* [`AI_INSTRUCTIONS.md`](./AI_INSTRUCTIONS.md): the condensed operating manual to copy
  into an app's `CLAUDE.md`.
* [`subtree.md`](./subtree.md) and [`operation-result.md`](./operation-result.md):
  self-contained library references; the [`trunk.js` README](../packages/trunk/README.md)
  covers `pick`, `AuthHandler` and the error base classes.
* [`PLAN.md`](./PLAN.md): analysis, decisions and status.

---

## 1. The idea in one page

An app is two layers plus a client for the backend:

```
+---------------------------------------------------------------------------+
|  UI layer   (src/pages/**, src/flows/**)                                  |
|                                                                           |
|   Flow  --builds-->  <Subtree controller={...}>  <Page/>  </Subtree>      |
|                            |                                              |
|                       Controller -- puts State + Actions into SubtreeModel|
|                            |             ^                                |
|             calls Ops -----+             |  useSubtree(State/Actions)     |
|             observes repos (sync)        |  observer.watch(rx) / <Obs>   |
+----------------------------|-------------|--------------------------------+
|  Core layer (src/core/**)  v             |   no React, no subtree.js/react|
|                                                                           |
|   Ops (pure functions)  --write-->  Repositories (ChangeNotifier)         |
|        |                            Services (long-lived, stateful)       |
|        | calls                      Session (LoggedinUser, AuthHandler)   |
+--------|------------------------------------------------------------------+
|  backend-client (separate package)                                        |
|   Transport -> API groups -> models -> role facades; Result<T,E> everywhere|
+---------------------------------------------------------------------------+
```

Rules that make it work:

1. **State is a plain object of reactive fields** (`Rx<T>`). Actions are plain methods on an
   interface. No reducers, no events, no code generation.
2. **Injection and observation are separate.** A page gets its `State` and `Actions` by
   identifier from the nearest `Subtree` (injection). It re-renders only for the `Rx` values
   it watches (observation).
3. **Controllers coordinate, Ops decide.** A controller maps UI intent to Ops calls and Ops
   results to state. Business rules and IO live in `core/ops`.
4. **Repositories store and notify. Nothing else.**
5. **Expected failures are values, unexpected failures are exceptions.** Every API/Op that
   can fail in a way the caller must handle returns `Result<T, E>`. Everything else throws
   and reaches the crash reporter.
6. **Navigation is a callback.** Controllers receive a `Routing` object of functions. They
   never import the router.
7. **Dependencies are explicit and typed.** Each page and flow declares the exact object
   shape it needs. In TypeScript that is structural typing, not a container.

---

## 2. Building blocks

| Block | Package | What it is |
|---|---|---|
| `Listenable`, `ValueListenable<T>` | `subtree.js/core` | The two interfaces everything reactive implements. `addListener/removeListener`; `value`. |
| `ChangeNotifier` | core | Base class for anything that notifies listeners. Repositories extend it. |
| `Rx<T>`, `RxList<T>`, `RxEvent<T>` | core | Reactive fields for page state. `Rx` notifies on change (`Object.is`), `RxList` on shallow change, `RxEvent` always. `.value` get/set exist for controllers only. |
| `Watchable<T>`, `View<S>` | core (types) | What a view sees. `Watchable<T>` is an `Rx` with `.value` removed; `View<S>` maps every `Rx` field of a state object to `Watchable`. `ref.watch` is the only read. Type-level only, zero runtime. |
| `BaseController` | core | `sync`, `subscribe`, `autoDispose`, `own`, `dispose`. For nested (section) controllers. |
| `SubtreeController` | core | `BaseController` + a `subtree: SubtreeModel`. One per page. |
| `SubtreeModel` | core | Per-page registry: `put(Token, instance)` / `get(Token)`. Throws on duplicates and on misses. |
| `<Subtree>` | `subtree.js/react` | Creates the controller on mount, recreates when `deps` change, disposes on unmount, provides its `SubtreeModel` to the tree. |
| `useSubtree(Token)` | react | Resolve `State`/`Actions` from the nearest `Subtree`. |
| `useObserver()` | react | The view-side observer. `observer.watch(rx)` reads a value and subscribes the component to it; `observer.disableUntilCompleted(action)` guards async actions. Explicit, no auto-tracking. |
| `<Obs>{ref => ...}</Obs>` | react | Fine-grained re-render island with the same `ref.watch` API. |
| `useWatch(rx)` | react | Optional one-value shorthand over `useObserver`. |
| `useRxEvent(event, handler)` | react | Run a side effect on every `emit` (navigation, toasts). |
| `Result<T, E>`, `AsyncResult<T, E>` | `operation-result.js` (TS) | Typed expected errors. `ok`, `fail`, `hasError`, `getError`, `getErrors`, `forward`, `unwrap`. |
| `AuthHandler`, `AuthenticatedCall` | `trunk.js` | Wraps authenticated calls; on an auth error triggers re-auth and retries. Works on `Result`, so `operation-result.js` is a peer dependency. |
| `pick()` | `trunk.js` | Narrows a `Deps` object to the keys a flow or page declares. |
| `Deps`, `Routing`, `Flow` | app code (conventions, helped by types) | Explicit dependency shapes, navigation callbacks, and the component that wires pages to routes. |

---

## 3. Core layer: `src/core/`

No React. No `subtree.js/react`. Only `subtree.js/core` (for `ChangeNotifier`),
`trunk.js` (for `AuthHandler`, `pick`) and `operation-result.js`.

```
src/core/
  primitives/    value objects, enums, validators (NationalId, Money, ...)
  repositories/  ChangeNotifier state holders. <Feature>Repository. No logic.
  ops/           business logic. Plain exported functions grouped per module.
  services/      long-lived stateful objects (pollers, sockets, autofill).
  auth/          session: LoggedinUser, AuthHandler, AuthStorage, in-flight
                 flow-state objects (SigningInUser).
```

### 3.1 Repositories

A repository owns one slice of app state, exposes it through getters and mutates it through
methods that call `notifyListeners()`. It contains no business logic and derives no view
state.

```ts
import { ChangeNotifier } from "subtree.js/core";

export class BalanceRepository extends ChangeNotifier {
  #balance: string | null = null;
  #error: string | null = null;

  get balance() { return this.#balance; }
  get error() { return this.#error; }

  setBalance(balance: string) {
    this.#balance = balance;
    this.#error = null;
    this.notifyListeners();
  }

  setError(error: string) {
    this.#error = error;
    this.notifyListeners();
  }

  reset() {
    this.#balance = null;
    this.#error = null;
    this.notifyListeners();
  }
}
```

Flavours: in-memory, storage-backed (in-memory cache plus `localStorage`/IndexedDB writes),
or exposing a discriminated-union state (`{ kind: "loading" } | { kind: "loaded", ... }`).

Controllers observe repositories with `sync` / `subscribe`. Only Ops mutate them.

### 3.2 Operations (Ops)

Business logic lives in plain functions. They hold no state; every dependency is a named
field of the single options argument, so call sites are self-documenting and tests pass
fakes.

```ts
// src/core/ops/balance-ops.ts
export async function fetchBalance(o: {
  balanceRepository: BalanceRepository;
  accountRepository: AccountRepository;
  loggedinUser: LoggedinUser;
  userApi: UserApi;
}): Promise<void> {
  try {
    const ctx = await o.loggedinUser.authorizeCall();
    const r = await o.userApi.balance(ctx, o.accountRepository.activeAccountId);
    if (!r.ok) { o.balanceRepository.setError(describeErrors(r.errors)); return; }
    o.balanceRepository.setBalance(formatMoney(r.value));
  } catch (e) {
    o.balanceRepository.setError(String(e));
  }
}
```

Return shape:

* `AsyncResult<T, E>` when the caller must handle a known failure.
* `Promise<void>` for best-effort work that reports its outcome by writing to a repository.

The client (or one API group) and the session object are separate named fields like every
other dependency: `{ userApi, authHandler, ... }` or `{ userApi, loggedinUser, ... }`. Do
not bundle them into an `Api` object, and do not put a `withSession` helper in front of
`callApi`. The field an op declares says what it does with a 401: `authHandler` retries it
after re-authentication, `loggedinUser` means the op handles it itself, or reads a stream.

Grouping: one module per feature (`balance-ops.ts`, `signin-ops.ts`). A namespace object
(`export const BalanceOps = { fetchBalance, ... }`) is optional; module imports are enough.

### 3.3 Services

Long-lived, stateful objects that orchestrate Ops over time and know *when*, not *what*:

```ts
export class DataPullerService {
  #timer: ReturnType<typeof setInterval> | null = null;
  constructor(private readonly intervalMs: number) {}

  async start(pull: () => Promise<void>) {
    this.stop();
    await pull();
    this.#timer = setInterval(() => void pull(), this.intervalMs);
  }
  stop() { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
  dispose() { this.stop(); }
}
```

Constructed once at startup, placed in the app dependencies, started/stopped by lifecycle Ops.

### 3.4 Session and authenticated calls

* `LoggedinUser extends ChangeNotifier` holds the session (`isLoggedIn`, ids, token),
  exposes `authorizeCall(): Promise<ApiContext>`, and `setAuthData` / `reset`.
* `AuthHandler.callApi(ctx => api.x(ctx))` injects the context and, on `ApiNotAuthorized`,
  calls `onAuthFailure(call)`; when re-auth succeeds the host calls `call.retry()`, and the
  original promise resolves with the retried result. `call.cancel()` resolves it with the
  auth-failed `Result` instead, so the caller stays in the Result model.
  (This is the btb-neo design. The admin_panel version that returns a never-resolving
  promise is not the target.)
* The function given to `callApi` is re-run from the start after re-authentication, so
  it is one call, or a block that is safe to replay. Several writes are several
  `callApi`s, each retried on its own; a loop over N rejects wraps each reject, not the
  loop, so a retry never repeats one that went through.
* `isAuthFailure` on the options decides which error means "not authenticated"; the
  default is `instanceof ApiNotAuthorized`. A backend client with its own 401 class sets it.
* Three ways to call, all valid: `authHandler.callApi` for user-facing reads/writes that
  should survive a 401; `loggedinUser.authorizeCall()` for background/best-effort code that
  handles auth failure itself; `loggedinUser.authorizeCall()` again for a stream or anything
  that is not a `Result`, since there is no single answer to retry.
* In-flight flow state (`SigningInUser`) is created once per flow and threaded through the
  pages that need it. Never global.

### 3.5 backend-client and the Result pattern

The API client is a separate package with the shape used in `hobby-pro/backend-client`:

* **Stateless client, explicit context.** Every method takes `ctx: ApiContext` first.
* **Layers**: `Transport` (HTTP and status mapping to `ApiNotAuthorized` / `ValidationError`),
  then API groups (endpoints, error translation to domain errors), then models (zod parse),
  then role facades (`MerchantClient`, `AdminClient`).
* **Typed expected errors**: every method returns `Promise<Result<T, E>>` with `E` a union
  of error classes. Unexpected HTTP outcomes throw.
* **e2e tests drive the backend only through the client.**

```ts
async me(ctx: ApiContext): Promise<Result<UserProfile, ApiNotAuthorized>> {
  const r = await this.t.get(ctx, "/user/me");
  return forward(r, j => parse(MeResponse, j).user, e => {
    if (e instanceof ValidationError) throw new UnexpectedApiError(e);
    return e;
  });
}
```

The Result API (TypeScript flavour, see section 5) replaces Dart's numbered `Errors2<...>`
with a plain union: `Result<T, ApiNotAuthorized | InvalidFormField>`.

---

## 4. UI layer: `src/pages/` and `src/flows/`

```
src/pages/<page>/
  <page>-model.ts           State class (Rx fields) + Actions abstract class
  <page>-controller.ts      Deps type, Routing type, Controller
  <page>-page.tsx           React view
  sections/<section>/       nested BaseController + model + view (optional)
src/flows/<flow>/           only for a multi-page sequence with state of its own
  <flow>-flow.tsx           Flow: its routes + Routing wiring + per-flow state
  pages/<page>/             as above
src/app.tsx                 root routes: one <Subtree> per page; a flow mounts as a nested route
```

A page is the unit: a model, a controller and a view. A flow is a sequence of pages that
belong together and share state the rest of the app never sees (sign-in with an OTP step,
onboarding, a checkout). An app whose pages are independent screens, three tabs and an
edit form say, has one primary flow and no `flows/` folder: its routes live in `app.tsx`
and every page takes its `Deps` straight from `AppDeps`.

### 4.1 Model: state and actions

```ts
import { Rx } from "subtree.js/core";

export class OtpState {
  static readonly resendSeconds = 59;
  readonly phoneSuffix = new Rx<string | null>(null);
  readonly otp = new Rx("");
  readonly isLoading = new Rx(false);
  readonly errorMessage = new Rx<string | null>(null);
  readonly countdown = new Rx(OtpState.resendSeconds);
}

export abstract class OtpActions {
  abstract onOtpChanged(value: string): void;
  abstract onOtpCompleted(otp: string): Promise<void>;
  abstract onResend(): Promise<void>;
}
```

`Actions` is an abstract class rather than an interface so it can be used as a runtime
token for `subtree.put` / `useSubtree`. A typed `Symbol` token is the alternative for
people who prefer interfaces; both are supported.

### 4.2 Controller

Three declarations per page: `Deps`, `Routing`, `Controller`.

```ts
import { SubtreeController } from "subtree.js/core";
import { hasError } from "operation-result.js";

// 1. Deps: the exact shape this page needs. Structural typing does the "import".
export type OtpDeps = Pick<SignInFlowDeps, "authApi" | "authStorage" | "loggedinUser"> & {
  signingInUser: SigningInUser;           // per-flow object passed explicitly
};

// 2. Routing: navigation callbacks provided by the flow.
export interface OtpRouting {
  onSignedIn(): void;
  onBack(): void;
}

// 3. Controller.
export class OtpController extends SubtreeController implements OtpActions {
  readonly state = new OtpState();

  constructor(readonly deps: OtpDeps, readonly routing: OtpRouting) {
    super();
    this.subtree.put(OtpState, this.state);
    this.subtree.put(OtpActions, this);

    // Runs now and whenever signingInUser notifies (e.g. a new OTP was requested).
    this.sync(() => {
      this.state.otp.value = "";
      this.state.phoneSuffix.value = deps.signingInUser.phoneSuffix;
      this.startCountdown();
    }, [deps.signingInUser]);
  }

  onOtpChanged(value: string) { this.state.otp.value = value; }

  async onOtpCompleted(otp: string) {
    if (this.state.isLoading.value) return;
    this.state.isLoading.value = true;
    this.state.errorMessage.value = null;
    try {
      const r = await verifyOtpAndSignIn({ otp, ...this.deps });
      if (!r.ok) {
        this.state.errorMessage.value = hasError(r, InvalidOtp) ? null : t("login.error");
        return;
      }
      this.routing.onSignedIn();
    } catch (e) {
      this.state.errorMessage.value = t("login.error");
      throw e;                             // unexpected: let the crash reporter see it
    } finally {
      this.state.isLoading.value = false;
    }
  }

  private startCountdown() {
    const id = setInterval(() => {
      if (this.state.countdown.value > 0) this.state.countdown.value--;
      else clearInterval(id);
    }, 1000);
    this.autoDispose(() => clearInterval(id));
  }
}
```

Rules:

* Register `state` and the `Actions` implementation in the constructor.
* No business logic. Call Ops.
* Observe repositories with `sync` (initial + changes) or `subscribe` (changes only).
* Navigate only through `routing.*`.
* Everything with a lifetime (timers, sockets, subscriptions) goes through `autoDispose`
  or `sync/subscribe`, so `dispose()` tears it down.
* Action methods are declared as arrow properties when the view passes them as bare
  callbacks (`onClick={actions.onResend}`); otherwise call them as `actions.onResend()`.

### 4.3 View

```tsx
import { useSubtree, useObserver, Obs } from "subtree.js/react";

export function OtpPage() {
  const state = useSubtree(OtpState);
  const actions = useSubtree(OtpActions);
  const observer = useObserver();

  return (
    <Page title={t("login.otp.title")} subtitle={observer.watch(state.phoneSuffix) ?? ""}>
      <OtpInput onChange={actions.onOtpChanged} onComplete={actions.onOtpCompleted} />
      <Obs>{ref => {                                  // re-render island
        const countdown = ref.watch(state.countdown);
        return countdown > 0
          ? <Countdown seconds={countdown} />
          : <button onClick={ref.disableUntilCompleted(actions.onResend)}>{t("login.otp.resend")}</button>;
      }}</Obs>
    </Page>
  );
}
```

* `useObserver()` once per component; `observer.watch(rx)` at every read. Explicit and
  visible: a reader sees exactly which values the component depends on. This is the same
  shape as `Obx((ref) => ref.watch(x))` in Dart.
* `<Obs>` for small islands inside a large component, to keep re-renders local.
* `useSubtree(OtpState)` returns `View<OtpState>`: every `Rx` field is a `Watchable` with
  no `.value`. Writing `state.otp.value` in a view is a compile error, reading it too. The
  rule "views watch, actions write" is enforced by the compiler, not by convention, and it
  costs nothing at runtime.
* No auto-tracking. That is deliberate; the preact-signals experiment in the Allimb apps
  is not the direction.
* Views never write to `Rx`. They call actions.
* Views never resolve repositories or Ops. Only `State` and `Actions`.

### 4.4 Sections: nested controllers

A big page is split into sections, each with its own model, controller and view. The root
`SubtreeController` creates them, hands them its `subtree`, and disposes them. A section
controller extends `BaseController` (no own `subtree`).

```ts
export class TopBarController extends BaseController implements TopBarActions {
  readonly state = new TopBarState();
  constructor(subtree: SubtreeModel, readonly deps: TopBarDeps, readonly routing: TopBarRouting) {
    super();
    subtree.put(TopBarState, this.state);
    subtree.put(TopBarActions, this);
    this.sync(() => this.mirrorBalance(), [deps.balanceRepository]);
  }
}

export class HomeController extends SubtreeController implements HomeActions {
  readonly state = new HomeState();
  readonly topBar: TopBarController;
  constructor(readonly deps: HomeDeps, readonly routing: HomeRouting) {
    super();
    this.subtree.put(HomeState, this.state);
    this.subtree.put(HomeActions, this);
    this.topBar = this.own(new TopBarController(this.subtree, deps, routing));
  }
}
```

`own(child)` registers `child.dispose` with `autoDispose` and returns the child.

The admin_panel already does this by hand (`MasterPasswordController(parentSubtree, deps)`);
the library formalises it.

### 4.5 Routes and flows

Something wires pages to routes and turns router calls into `Routing` callbacks. With
`react-router` that is a component that renders `<Routes>`; every page is a `<Subtree>`
whose controller factory receives `pick(deps, ...)` and a routing object built from
`useNavigate`. In an app with one primary flow that component is `app.tsx`. A Flow is the
same component for a multi-page sequence with state of its own, mounted as a nested route;
add one only when the pages share something the rest of the app must not see.

```tsx
export function SignInFlow({ deps, routing }: { deps: SignInFlowDeps; routing: SignInFlowRouting }) {
  const navigate = useNavigate();
  const [signingInUser] = useState(() => createSigningInUser(deps.config)); // per-flow state

  return (
    <Routes>
      <Route index element={
        <Subtree key="national-id" controller={() => new NationalIdController(
          { ...pick(deps, "recaptcha", "config"), signingInUser },
          { onOtpRequested: () => navigate("otp"), onBack: () => navigate(-1) })}>
          <NationalIdPage />
        </Subtree>} />
      <Route path="otp" element={
        <Subtree key="otp" controller={() => new OtpController(
          { ...pick(deps, "authApi", "authStorage", "loggedinUser"), signingInUser },
          { onSignedIn: routing.onSignedIn, onBack: () => navigate(-1) })}>
          <OtpPage />
        </Subtree>} />
    </Routes>
  );
}
```

* `Subtree` keeps the controller for the life of the route element. Pass `deps={[id]}`
  when the same route must get a fresh controller for a different entity (`/users/:id`).
  This replaces the `key="..."` workaround used in the admin_panel and sales_portal.
* Sibling routes render their elements at the same position in the React tree, so React
  reuses the `<Subtree>` instance (and its controller) across them. Give each route's
  `<Subtree>` a `key` (`key="login"`, `key="otp"`); the symptom otherwise is
  "`OtpState` is not in the subtree model" when navigating between the two.
* Route params are a plain argument of the controller, read once by the flow:

  ```tsx
  function DoctorDetailsRoute() {
    const { doctorId } = useParams();
    return (
      <Subtree deps={[doctorId]} controller={() => new DoctorDetailsController({ doctorId }, deps, routing)}>
        <DoctorDetailsPage />
      </Subtree>
    );
  }
  ```

  The controller validates the param (`"Invalid doctor id"` is state, not a crash) and the
  page never calls `useParams` itself.
* Nested flows are nested `<Routes>`; the parent builds the child's deps with `pick` and
  its routing from its own navigation.
* Per-flow objects (`signingInUser`) live in the flow component (`useState`) and are passed
  explicitly to the pages that need them.
* Modals and dialogs are sections (4.4) or child `Subtree`s, not routes, unless they are
  deep-linkable.

### 4.6 Dependencies: structural typing instead of a container

Dart needs `immutable_di` because it cannot express "the subset of fields this page uses"
without a runtime container. TypeScript can:

```ts
// app root
export interface AppDeps {
  authStorage: AuthStorage; loggedinUser: LoggedinUser; backendApi: MerchantClient;
  balanceRepository: BalanceRepository; dataPuller: DataPullerService; /* ... */
}

// flow
export type SignInFlowDeps = Pick<AppDeps, "authStorage" | "loggedinUser" | "backendApi" | "config">;

// page
export type OtpDeps = Pick<SignInFlowDeps, "authStorage" | "loggedinUser"> & { signingInUser: SigningInUser };
```

Passing `appDeps` where `SignInFlowDeps` is expected compiles because it is a superset.
`pick(obj, ...keys)` from `trunk.js` narrows at runtime when a flow should not leak more than it declares
(useful for tests and for reading the code). A page that needs something the flow does not
export takes it as an explicit field, exactly as in Dart.

A session-scoped container (`AuthedAppDeps = AppDeps & { authHandler: AuthHandler }`) is just
an intersection type.

---

## 5. The Result pattern (TypeScript)

```ts
type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly errors: readonly E[] };
type AsyncResult<T, E> = Promise<Result<T, E>>;

ok(value)                    fail(...errors)
hasError(r, Cls)             getError(r, Cls)          getErrors(r, Cls)
hasSingleError(r, Cls)       unwrap(r)  /* throws if failed */
forward(r, success, failure) /* map value and each error; throw for unexpected */
describeErrors(errors)
```

* Errors are classes (so `instanceof` works and stack traces exist). `trunk.js` provides
  the `AppError` base with an optional `cause` and the `ApiNotAuthorized` error that
  `AuthHandler` recognises.
* Declared errors are the union `E`. The compiler forces the failure mapper of `forward` to
  return a member of the target union, so adding a transport error breaks every method
  until it takes a position.
* Read `value` only after handling every member of `E`; `unwrap` documents that.
* Controllers map results to state: check the specific errors that change UI, treat the
  rest as a generic failure, `return` early.
* Never wrap: an `AsyncResult` is already a `Promise`.

Compared with Dart's `operation_result`, the TS version has no `Errors1..6` and no runtime
"unexpected error" assertion in the constructor. The union type does that job at compile
time, which is the reason `backend-client` reads better than the Dart code.

---

## 6. Reactivity and lifecycle rules

| Need | Use |
|---|---|
| A value the view watches | `Rx<T>` |
| A list the view watches | `RxList<T>` (readonly array, shallow-compared) |
| A one-shot signal (navigate, toast) | `RxEvent<T>` + `useRxEvent` (or a `subscribe` in the controller when it can act itself) |
| Load/mirror data from repositories now and on change | `sync(fn, [repo, ...])` |
| Side effect only on change | `subscribe(fn, [rx, ...])` |
| Derived state in a controller | `sync(fn, [rx, ...])` over the fields it reads; `Rx` is a `Listenable`. Not `ReactiveBlock`, which is for tests and code outside a controller |
| Anything with a handle to release | `autoDispose(() => ...)` |
| Prevent double-submit from the view | `ref.disableUntilCompleted(action)` |
| Prevent double-submit in the controller | guard on an `Rx<boolean>` (`isLoading`) |

* `Rx.value = x` notifies only when `Object.is(old, x)` is false. Replace objects and arrays,
  do not mutate them (`rx.update(v => ({ ...v, a }))`).
* `.value` is a controller API. Views get `Watchable<T>` through `useSubtree` and can only
  `ref.watch` it. A section controller that reads the parent's state through
  `SubtreeModel.get` still gets the full `Rx`.
* A foreign `ValueListenable` (a third-party notifier) becomes watchable through
  `watchable(vl)`; repositories are observed by controllers with `sync`, not by views.
* `sync` may be `async`; `await controller.sync(...).ready` waits for the first run.
  Both `sync` and `subscribe` return a `Subscription` with `cancel()`.
* `sync` and `subscribe` accept any `Listenable`: repositories, `Rx`, other controllers'
  state, third-party notifiers wrapped in an adapter.
* Writing to a disposed controller's `Rx` is harmless (no listeners). A controller that
  must not navigate after it was disposed checks `this.isDisposed` after an `await`.
* The view layer is StrictMode-safe: `Subtree` recreates a controller that StrictMode
  disposed during its simulated unmount; observers subscribe in effects, not during render.

---

## 7. Testing

* **Ops**: unit tests with fake repositories (real `ChangeNotifier` subclasses) and a fake
  API returning `ok(...)` / `fail(...)`. No React.
* **Controllers**: construct with fake deps and a routing object of spies; drive actions;
  assert on `state.x.value` and on spies. No React. (Same shape as
  `subtree/full_examples/flutter_login/test/login/login_controller_test.dart`.)
* **Views**: render inside `<SubtreeProvider model={model}>` where `model` is a
  `SubtreeModel` with a real `State` and a mocked `Actions`; set `state.x.value` and assert
  the DOM; fire events and assert the mock was called.
* **Flows**: render the app or flow with a `MemoryRouter` and real or fake deps, StrictMode
  on. After a page appears, `await act(flush)` before typing (StrictMode replaces the
  first controller from an effect), and wrap `fireEvent` in `act` so controller writes
  reach the DOM before the next step. `sync` runs its first pass in a microtask, so
  `await flush()` before asserting on mirrored state.
* **Backend**: e2e through `backend-client` only.

The examples show every level: `examples/login/src/core/ops/*.test.ts`,
`**/*-controller.test.ts`, `**/*-page.test.tsx`, `app.test.tsx`.

---

## 8. Adding a feature ("Appointments")

1. `core/primitives`: value objects, enums.
2. `core/repositories/appointments-repository.ts`: `ChangeNotifier`, getters, mutators.
3. `core/ops/appointment-ops.ts`: functions taking `{ repository, api, authHandler }`,
   returning `AsyncResult` for expected errors.
4. Add the repository (and any service/API) to `AppDeps` and its construction in
   `createAppDeps()`.
5. `pages/appointments/`: a model, a controller (with `Deps`, `Routing`) and a page; the
   route in `app.tsx`. A `flows/appointments/` flow component only when the feature is a
   multi-page sequence with state of its own.
6. Tests: ops, controller, page.

---

## 9. Differences from the Flutter version

| Flutter / Dart | TypeScript / React | Why |
|---|---|---|
| `ControlledSubtree(subtree:, controller:, deps:)` | `<Subtree controller={} deps={}>children</Subtree>` | JSX |
| `context.get<T>()` | `useSubtree(Token)` | no reified generics: the token is the class or a symbol |
| `Obx((ref) => ...)` | `useObserver()` + `observer.watch(rx)`; `<Obs>{ref => ...}</Obs>` for islands | hooks are the idiomatic unit; the explicit `watch` stays |
| `EventListener` widget | `useRxEvent(event, handler)` | hook |
| `immutable_di` containers | `interface` + `Pick` + `pick()` | structural typing |
| `Errors2<A, B>` + `success2/failure2/forward2` | `Result<T, A \| B>` + `ok/fail/forward` | union types |
| `abstract final class XOps { static ... }` | module of exported functions | modules are namespaces |
| `Navigator` + `Route` factories | `react-router` `<Routes>` inside a flow component | router of choice; the Routing callback boundary is the same |
| `.tr()` | `t()` from the app's i18n | unchanged rule: all strings localized |
