# Analysis and plan: a complete subtree stack for TypeScript / React

Date: 2026-09-23. Companion to [ARCHITECTURE.md](./ARCHITECTURE.md), which describes the
target. This file records what exists today, what is missing, the design decisions, and
the phased plan.

Sources analysed:

| Codebase | Role |
|---|---|
| `D:\apps\subtree` (Dart, v0.6.1) | The original library: `Rx/RxList/RxEvent`, `Obx`, `BaseController/SubtreeController` with `sync/subscribe`, `ControlledSubtree` with `deps`, `SubtreeModelContainer`, `EventListener`, `disableUntilCompleted`. Tests and two full examples. |
| `D:\apps\subtree.js` (this repo, v1.0.0) | Partial React port: `Rx`, `ChangeNotifier`, `SubtreeModel`, `SubtreeController` (dispose only), `<Subtree>`, `useSubtree`, `useObserver`, `obs()`. No tests, no README. |
| `btb-neo` (Flutter app) | The full architecture on top of `subtree` + `immutable_di` + `operation_result`: core (repositories, ops, services, auth) and UI (flows, pages, sections). `CLAUDE.md` and `doc/architecture/*` document it. |
| `hobby-pro/backend-client` (TS) | The result pattern done well in TypeScript: `Result<T,E>` union, class errors, `forward`, `Transport` to API groups to facades, e2e through the client. |
| `allimb/admin_panel`, `allimb/sales_portal` (React 19 + Vite) | Real `subtree.js` usage. Shows what the current port makes people do: vendored copy, `key` hack for controller identity, ad-hoc deps objects, `T | ApiNotAuthorized` unions, never-resolving promise in `AuthHandler`, `@preact/signals-react` on the small pages next to `Rx` on the big ones. |

---

## 1. Where the current `subtree.js` stands

### 1.1 Bugs and design gaps in the existing code

| Where | Issue | Effect |
|---|---|---|
| `lib/subtree.tsx:16-20` | `useEffect(() => () => controller.dispose(), [controller, props])` depends on `props`. `props.children` is a new object on every parent render, so the effect re-runs and **disposes the live controller** while the tree keeps using it. Nothing recreates it. | Subscriptions and timers silently die after the first parent re-render. In `admin_panel` this is masked because route elements rarely re-render. |
| `lib/subtree.tsx` | No `deps` prop. The controller is created once via `useState(props.controller)`. | Same route with a different entity keeps the old controller. `admin_panel` works around it with `key="..."`. |
| `lib/subtree.tsx` | Not StrictMode-safe: dev double-mount disposes the controller and never recreates it. | React 18/19 dev mode breaks pages after first mount. |
| `lib/useObserver.ts:17-24` | `watch()` subscribes **during render**. Discarded renders (StrictMode, Suspense) leak listeners; there is no `useSyncExternalStore`, so tearing is possible in concurrent mode. | Leaks and stale renders. |
| `lib/rx.ts:54` | `Rx.value` getter **throws**; controllers must use `snapshot`. Diverges from the Dart API and from every controller in btb-neo (`state.x.value` everywhere). | Friction. Likely one reason `admin_panel` moved to signals. |
| `lib/model.ts:25` | `get()` uses `if (instance)`; a registered `0`, `""` or `false` is reported as missing. `put()` silently overwrites duplicates (Dart throws). | Wrong error, hidden double registration. |
| `lib/controller.ts` | Only `autoDispose`/`dispose`. No `sync`, `subscribe`, `BaseController`, `own`. | Controllers cannot observe repositories; the core pattern of the architecture is unsupported. |
| `lib/obs.tsx` | `obs(render)` is a class component; `Observer` is shared with hooks but has no `disableUntilCompleted`. | Half of `Obx` is missing. |
| Missing | `RxList`, `RxEvent`, `useRxEvent`/`EventListener`, `ReactiveBlock`, `SubtreeProvider` for tests, `isDisposed`. | Parity gaps with Dart 0.6.1. |
| `package.json`, `tsconfig.json` | TS 4.9, target ES5, CommonJS only, no ESM, no `exports` map, no tests, `main` points to `dist` that is committed. | Cannot be consumed cleanly by Vite/ESM apps; `admin_panel` vendored the sources instead of installing the package. |
| Repo | No README, no CHANGELOG, no CI. | Nobody but the author can use it. |

### 1.2 What btb-neo does that no library supports (Dart or TS)

These are conventions today, enforced by `CLAUDE.md` and code review:

1. **Page = Model + Controller + View**, with `Deps` and `Routing` declared next to the
   controller.
2. **Sections**: nested `BaseController`s that register into the parent's `subtree` and are
   disposed by the parent by hand (`HomeController.dispose`).
3. **Flows**: a class per flow that owns navigation, builds routes, threads per-flow state
   (`SigningInUser`) and wires `Routing` callbacks.
4. **Deps containers** via `immutable_di` with `.import(container)` and `export` lists,
   a lot of ceremony that TypeScript does not need.
5. **Ops as static-only classes**, repositories as `ChangeNotifier`, services as plain
   classes, session as `LoggedinUser` + `AuthHandler` with retry-after-reauth.
6. **Result pattern** with numbered `ErrorsN` and `successN/failureN/forwardN`.

The TS stack should make 1 to 3 library features, 4 a typing convention, and 5 to 6 a
second small library plus documented recipes.

### 1.3 What to take from `backend-client`

* `Result<T,E>` as a discriminated union with `ok/fail/hasError/getError/forward/unwrap/describeErrors`.
* Errors as classes with a common base carrying `originalError`.
* `TransportError` union that forces every API method's failure mapper to take a position.
* `ApiContext` passed explicitly; stateless clients; role facades.
* The guide (`backend-client-guide.md`) as the template for the client-side doc.

Small improvements to make in the port: `getErrors`, `hasSingleError`, `AsyncResult`
alias, `ensureSuccess`, a `Result` narrowing helper for tests, and an `AuthHandler` that
retries instead of hanging.

### 1.4 What `admin_panel` and `sales_portal` tell us

* Two state styles coexist. A few small components (Home, SignIn, the password dialogs)
  use `@preact/signals-react`; the pages with real work (CreateDoctor with 13 fields,
  DoctorDetails, Doctors, Patients, Managers) use `Rx` + `useObserver`. The signals
  experiment is considered a mistake: `useObserver()` plus `observer.watch(x)` is little
  code and has zero magic, which is the property to keep. Section 1.5 records the decision.
* `MasterPasswordController(parentSubtree, deps)` is exactly the section pattern; it just
  lacks lifecycle (`dispose`, `sync`).
* `sales_portal`'s `DoctorDetailsRoute` builds `key={"doctor-details-" + params.doctorId}`
  and passes `{doctorId}` into the controller. That is the `deps` prop plus a documented
  "route params are a controller argument" rule.
* `sales_portal`'s `HomeController` carries a `diposed = "not disposed"` debug field: the
  disposal bug in `Subtree` (1.1) was already being chased in the app.
* `AuthHandler.callApi` returning `new Promise(() => {})` leaks every pending call.
* API methods returning `T | ApiNotAuthorized | Error` push `instanceof` checks and even
  `constructor.name` string comparisons into controllers. `Result` fixes that.
* `App.tsx` already is a "flow": `AppNavigation` (a `Routing`), `createDependencies`
  (a `Deps`), `<Subtree key=... controller=...>` per route. The library should make that
  shape first-class.

### 1.5 Rx versus preact signals: decided

Decision: own `Rx` core with explicit observation. `useObserver()` + `observer.watch(x)`
is the view API, the same shape as `Obx((ref) => ref.watch(x))` in Dart. No auto-tracking,
no global "current observer", no Babel transform, no helper that introspects a state object.

Why signals were a mistake here:

* `@preact/signals-react` needs `useSignals()` in every component anyway, so it did not
  remove a step; it only hid which values a component depends on.
* It patches React internals and has broken on React upgrades.
* A signals-only core loses `Listenable` for repositories and `RxEvent` (signals drop
  equal values), and it splits the mental model between the Flutter and TS codebases.

What the library does for the view layer instead: fix `useObserver` (subscribe in effects,
StrictMode-safe, `useSyncExternalStore`-based re-render), add `disableUntilCompleted` to the
observer ref, and provide `<Obs>` for re-render islands. `useWatch(rx)` is kept only as a
one-value shorthand over the same mechanism; it is optional.

---

## 2. Target: packages and responsibilities

Monorepo in this repository (npm workspaces), three publishable packages plus examples:

```
subtree.js/
  packages/
    subtree/            npm: subtree.js         React-agnostic core + React bindings
      src/core/         Listenable, ChangeNotifier, Rx, RxList, RxEvent, ReactiveBlock,
                        BaseController, SubtreeController, SubtreeModel, Watchable, View
      src/react/        Subtree, SubtreeProvider, useSubtree, useObserver, Obs, useWatch,
                        useRxEvent
      exports: "subtree.js" (all), "subtree.js/core" (no React), "subtree.js/react"
    trunk/              npm: trunk.js           application-structure support, no React:
                        pick(), AuthHandler, AuthenticatedCall, AuthContextProvider,
                        AppError base, ApiNotAuthorized, Deps/Routing/Flow conventions. Peer deps: operation-result.js
                        (and subtree.js/core only if a helper needs Listenable)
    operation-result/   npm: operation-result.js   Result, AsyncResult, helpers.
                        Nothing else: it must stay usable by backend-client packages alone.
    create-subtree-app/ (later) scaffolding: core/flows skeleton, AppDeps, example flow
  examples/
    notes/              port of subtree/full_examples/notes_app (React + react-router)
    login/              port of flutter_login: flow, sections, Result, AuthHandler, tests
  docs/
    ARCHITECTURE.md     the architecture (done)
    PLAN.md             this file
    subtree.md          library reference (like btb-neo/doc/architecture/subtree.md)
    operation-result.md library reference
    AI_INSTRUCTIONS.md  drop-in CLAUDE.md section for apps using the stack
```

Why three packages: `operation-result.js` is used by `backend-client`-style packages and
must not depend on anything. `subtree.js` is the state manager and stays usable on its own.
`trunk.js` is the application structure that grows the subtrees: `pick()`, `AuthHandler`,
the `Deps`/`Routing`/`Flow` conventions and whatever structure helpers two apps end up
sharing. It depends on `operation-result.js`; `subtree.js` never depends on it. The name
pairs with `subtree.js` (both free on npm as of 2026-09-23; `operation-result` itself is
taken by another author, hence the `.js` suffix).

### 2.1 API surface: `subtree.js/core`

```ts
interface Listenable { addListener(l: () => void): void; removeListener(l: () => void): void }
interface ValueListenable<T> extends Listenable { readonly value: T }

class ChangeNotifier implements Listenable {
  protected notifyListeners(): void
  get hasListeners(): boolean
  dispose(): void                          // drops listeners
}

declare const READ: unique symbol
interface Watchable<T> extends Listenable { readonly [READ]: () => T }   // what views see: no .value

class Rx<T> extends ChangeNotifier implements ValueListenable<T>, Watchable<T> {
  constructor(value: T, equals?: (a: T, b: T) => boolean)   // default Object.is
  get value(): T;  set value(v: T)          // controllers only; notifies on change
  update(fn: (v: T) => T): void
}

// Type-level view of a state object: every Rx becomes a Watchable, recursively;
// functions and primitives pass through. Zero runtime cost.
type View<S> = { readonly [K in keyof S]:
  S[K] extends Rx<infer T> ? Watchable<T> :
  S[K] extends (...a: any[]) => any ? S[K] :
  S[K] extends object ? View<S[K]> : S[K] }
function watchable<T>(v: ValueListenable<T>): Watchable<T>   // adapter for foreign notifiers
class RxList<T> extends Rx<readonly T[]>    // shallow array equality; stores a frozen copy
class RxEvent<T> extends ChangeNotifier implements ValueListenable<T | undefined> {
  emit(v: T): void                          // always notifies
}

class ReactiveBlock { constructor(fn: (ref: { watch<T>(v: ValueListenable<T>): T }) => void); dispose() }

class Subscription { cancel(): void }
class BaseController {
  sync(fn: () => void | Promise<void>, on: Listenable[]): Promise<void>   // runs now + on change
  subscribe(fn: () => void, on: Listenable[]): Subscription              // on change only
  autoDispose(fn: (() => void) | (() => void)[]): void
  own<C extends { dispose(): void }>(child: C): C
  get isDisposed(): boolean
  dispose(): void
}
class SubtreeController extends BaseController { readonly subtree: SubtreeModel }

type Token<T> = (abstract new (...a: any[]) => T) | TypedSymbol<T>
function token<T>(description: string): TypedSymbol<T>
class SubtreeModel {
  put<T>(token: Token<T>, instance: T): T   // throws on duplicate
  get<T>(token: Token<T>): T                // throws on miss, falsy-safe
  has(token: Token<unknown>): boolean
}
```

### 2.2 API surface: `subtree.js/react`

```tsx
<Subtree controller={() => ctrl} deps?={unknown[]}>children</Subtree>
  // create on mount; recreate when deps change (shallow); dispose on unmount;
  // StrictMode-safe (lazy ref + recreate-if-disposed on effect re-run)
<SubtreeProvider model={subtreeModel}>children</SubtreeProvider>   // tests, storybook
useSubtree<T>(token: Token<T>): View<T>   // views see Watchable fields, never .value;
                                          // SubtreeModel.get (controllers) stays unmapped
useObserver(): ObserverRef   // PRIMARY. { watch<T>(w: Watchable<T>): T, disableUntilCompleted };
                             // watch() reads the value and records the dependency; subscriptions
                             // are applied in an effect (StrictMode-safe), cleaned up on unmount
<Obs>{(ref: ObserverRef) => ReactNode}</Obs>                      // re-render island
useWatch<T>(v: ValueListenable<T>): T                              // optional one-value shorthand
useRxEvent<T>(event: RxEvent<T>, handler: (v: T) => void): void
```

`useObserver` implementation note: collect watched listenables during render into a
pending set; in a layout effect, diff against the subscribed set and add/remove listeners;
re-render through `useReducer`. That keeps render pure and StrictMode-safe while keeping
the `ref.watch(x)` call style from Dart.

### 2.3 API surface: `operation-result.js`

```ts
type Result<T, E>; type AsyncResult<T, E> = Promise<Result<T, E>>
ok, fail, hasError, hasSingleError, getError, getErrors, unwrap, ensureSuccess,
forward(r, success, failure), mapValue(r, f), describeErrors
```

### 2.4 API surface: `trunk.js`

Application-structure support. No React. Peer dependency on `operation-result.js` for the
`Result` types used by `AuthHandler`.

```ts
function pick<T, K extends keyof T>(o: T, ...keys: K[]): Pick<T, K>   // narrow a Deps object

abstract class AppError extends Error { constructor(message: string, readonly cause?: unknown) }
class ApiNotAuthorized extends AppError                              // what AuthHandler looks for

interface AuthContextProvider<Ctx> { authorizeCall(): Promise<Ctx> }   // LoggedinUser implements it
class AuthenticatedCall<T, E, Ctx> { retry(): Promise<boolean>; cancel(): void }
class AuthHandler<Ctx> {
  constructor(o: { provider: AuthContextProvider<Ctx>;
                   onAuthFailure: (call: AuthenticatedCall) => void;
                   onLogout?: () => void })
  callApi<T, E>(f: (ctx: Ctx) => AsyncResult<T, E>): AsyncResult<T, E>
  logout(): void
}
```

Candidates for later, once two apps need them: a `Service` interface (`dispose()`), a
`createDeps` helper for typed root containers, a react-router flow helper (would live in
`subtree.js/react`, not here).

---

## 3. Design decisions

| Decision | Choice | Alternative considered | Why |
|---|---|---|---|
| Reactive core | Own `Listenable`-based `Rx` (as in Dart); explicit `observer.watch(x)` in views | preact signals (tried in admin_panel and sales_portal, rejected; see 1.5) | Framework-agnostic core, zero magic, controllers testable in Node, one mental model with the Flutter code. |
| `Rx.value` in controllers | Plain getter, no throw | Keep `snapshot` | Matches Dart and every btb-neo controller. `snapshot` stays as a deprecated alias for one release. |
| `.value` in views | Hidden by types: `useSubtree` returns `View<S>`, where every `Rx<T>` is a `Watchable<T>` with no `value`; `ref.watch` is the only read | Runtime guard (today's throwing getter); convention only | The rule "views only watch, only actions write" becomes a compile error at zero runtime cost, and controllers keep `.value`. |
| Dependency injection | Structural typing (`Pick`, intersections, `pick()`) | Port `immutable_di`; inversify (present in admin_panel deps but unused) | TS checks the subset at compile time; a container adds runtime indirection and loses type inference. |
| Tokens | Abstract class or `token<T>()` symbol | String keys | Classes work today; symbols allow interface-only actions. |
| Result | Union `Result<T, E>` from backend-client | Port `ErrorsN` | Union types make `ErrorsN` unnecessary and read better. |
| Controller identity in React | `deps` prop on `Subtree` | `key` | Matches Dart's `ControlledSubtree.deps`; `key` still works for people who prefer it. |
| Router coupling | None in the library; `Flow` is an app-level component pattern documented with react-router | A `subtree.js/router` adapter | Keep the library small; add an adapter later if two apps want the same helper. |
| Build | `tsup` (ESM + CJS + d.ts), TS 5.x, `exports` map, React 18 and 19 peer range | tsc only | Vite/ESM consumers, subpath exports. |
| Tests | `vitest` + `@testing-library/react`; StrictMode on in every React test | none | Regressions listed in 1.1 must not come back. |
| Repo layout | npm workspaces monorepo here | Separate repo per package | Shared tooling and examples; `operation-result.js` can be split out later if it grows. |

---

## 4. Phased plan

Each phase ends green (typecheck, tests, build) and is publishable on its own.

**Status (2026-09-23): Phases 0 to 3 are implemented** in `packages/`; `npm run check`
is green (typecheck, biome, 146 tests including type tests, tsup builds with `.d.ts`).
Deltas from the API surface written above, decided during implementation:

* `sync()` returns a `Subscription` whose `ready` promise resolves after the first run
  (`await ctrl.sync(...).ready`), instead of returning a bare promise; `subscribe()`
  returns the same `Subscription` type. Both refuse to be called after `dispose()`.
* `PendingCall.cancel()` resolves the caller with the auth-failed `Result` rather than
  rejecting with an exception, so callers stay in the Result model.
* `fails(list)` added next to `fail(e, ...more)`; `ok()` with no argument for `void`.
* `RxEvent<T = void>`; `readWatchable()` and the `READ` symbol are exported for tests and
  bindings; `token<T>()` replaces string identifiers.
* `useSubtree` maps with `View<T>`; `useWatch` is built on `useSyncExternalStore`, the
  observer on an effect with a stale-value check.
* `tsconfig` is not `composite` (tsup's declaration bundler rejects it); typecheck runs
  per package.

**Phase 4 is implemented** (2026-09-23): `examples/login` and `examples/notes`, each a Vite
app in the workspace with ops, controller, page and flow tests (65 tests in total), running
in `npm run check`. What the examples taught, and what changed because of them:

* Sibling routes render their `<Subtree>` at the same tree position, so React reuses the
  instance and its controller across routes. Each route's `<Subtree>` needs a `key`; the
  architecture doc says so now, and `SubtreeModel.get` hints at it in its error message.
* Under StrictMode the controller built during the first render is replaced from an
  effect. In flow tests, wait for the page and let effects settle (`await act(flush)`)
  before typing; input sent earlier goes to the discarded controller.
* Test helpers wrap `fireEvent` in an explicit `act` so controller writes reach the DOM
  before the next step.
* `AuthHandler` needs no `isAuthError` option any more: `ApiNotAuthorized` moved to
  `trunk.js` together with `AppError`, and the handler recognises it by `instanceof`.
* The examples compile the packages from source through aliases (`vite.config.ts`,
  `tsconfig.json` `paths`), so they never run against a stale `dist`.

Phases 5 to 7 are not started.

### Phase 0: repository setup

* Workspaces, `tsup`, `vitest`, biome (as in backend-client) or eslint, CI (typecheck,
  test, build), `CHANGELOG.md`, README skeleton, `LICENSE` kept.
* Fix git "dubious ownership" locally (`git config --global --add safe.directory D:/apps/subtree.js`).
* Keep the current `lib/` compiling until Phase 2 replaces it; publish nothing yet.

### Phase 1: `subtree.js/core` parity with Dart 0.6.1

* `Rx` (getter fixed, custom equality), `RxList`, `RxEvent`, `ChangeNotifier` with
  `hasListeners`/`dispose`, `ReactiveBlock`.
* `Watchable<T>`, the `View<S>` mapped type and the `watchable()` adapter; type tests
  (`expectTypeOf`) proving `View<State>` has no `.value` and that `ref.watch` accepts
  `Rx`, `RxList`, `RxEvent` and adapted notifiers.
* `BaseController` with `sync`/`subscribe`/`autoDispose`/`own`/`isDisposed`,
  `SubtreeController`.
* `SubtreeModel` with duplicate and falsy fixes, `has`, `token<T>()`.
* `pick()`.
* Tests ported from `subtree/test/*.dart` (rx, model container, sync, subscribe, reactive
  block, async action).

### Phase 2: `subtree.js/react`

* `Subtree` rewritten: lazy creation, `deps`, StrictMode-safe dispose/recreate, no
  disposal on child re-render. Tests cover StrictMode double-mount, deps change, parent
  re-render.
* `useSubtree` typed as `View<T>`; `useObserver` subscribing in effects with
  `watch(w: Watchable<T>)`; `<Obs>`; `useRxEvent`; `SubtreeProvider`; `useWatch` shorthand.
  The throwing `value` getter is removed: the type-level `View` replaces the runtime guard.
* `disableUntilCompleted` on the observer ref.
* Remove `obs()` class component (keep as thin wrapper over `<Obs>` for one release).
* README for the package, `docs/subtree.md` reference.

### Phase 3: `operation-result.js` and `trunk.js`

* Port `result.ts` from backend-client plus `getErrors`, `hasSingleError`, `ensureSuccess`,
  `mapValue`, `AsyncResult`.
* `trunk.js`: `pick()`; `AuthHandler` / `AuthenticatedCall` ported from btb-neo
  (`lib/core/auth/auth_handler.dart`), generic over the context and the auth-error
  predicate, with `operation-result.js` as a peer dependency.
* Tests: results, forward contract (mapper must return the union), AuthHandler retry and
  cancel, `pick` typing.
* `docs/operation-result.md` (port of `btb-neo/doc/architecture/operation_result.md` with
  the union API).

### Phase 4: examples that prove the architecture (done)

* `examples/login`: port `subtree/full_examples/flutter_login` with a fake backend-client
  (`Result` everywhere), `AuthHandler`, a `SignInFlow` component with two pages (sign-in,
  session expired), a `HomeFlow` with one section (profile), controller tests, page tests
  with `SubtreeProvider`, flow test with `MemoryRouter`.
* `examples/notes`: port `notes_app` (list + edit, repository + ops, `sync` from a
  repository, `deps={[id]}` for the route parameter).
* Both examples are the acceptance test of the API: if something is awkward there, change
  the library, not the example. See the status note above for what came out of it.

### Phase 5: documentation for humans and agents

* `docs/AI_INSTRUCTIONS.md`: the `CLAUDE.md` section for apps (the btb-neo one translated
  to TS, referencing `ARCHITECTURE.md`).
* Cross-links: ARCHITECTURE, subtree reference, operation-result.js reference, examples.
* CHANGELOG entries; publish `subtree.js@2.0.0` (breaking: `Rx.value`, `Subtree` semantics,
  ESM) and `operation-result.js@1.0.0`.

### Phase 6: migrate `admin_panel` (validation on a real app)

* Replace the vendored `src/3d-party/subtree.js` with the package; drop the `key` hack in
  favour of `deps` where needed.
* Convert `AdminApi` to `Result` returns; replace `AuthHandler` with the retrying one.
* Convert the signals-based pages back to `Rx` with `useObserver`, and the dialog
  controllers to `BaseController` sections owned by the page controller. Drop
  `@preact/signals-react` and the unused `inversify` dependency.
* Do the same in `sales_portal`; its `DoctorDetailsRoute` becomes
  `<Subtree deps={[doctorId]} controller={() => new DoctorDetailsController({doctorId}, ...)}>`.
* Extract `AppNavigation` + `createDependencies` + routes into flow components per area.
* Record what hurt as issues on the library before publishing 2.0 final.

### Phase 7 (optional): `create-subtree-app`

* Scaffold: `src/core/{primitives,repositories,ops,services,auth}`, `src/flows/`, `AppDeps`,
  `createAppDeps`, one flow, tests, `CLAUDE.md`. Only worth doing after a second app adopts
  the stack.

---

## 5. Decisions needed from you

1. **Monorepo here vs separate repos** for `trunk.js`, `operation-result.js` and the
   examples. The plan assumes here.
2. **React version floor.** Plan assumes React 18+ (needed for `useSyncExternalStore`).
   `admin_panel` is on 19. If 16/17 support matters, `use-sync-external-store/shim` is
   needed.
3. **Router**: keep the library router-free and document react-router flows (planned), or
   ship a small `subtree.js/router` helper for `Flow` components.
4. **`operation-result.js` API**: union-based (planned) versus a faithful `ErrorsN` port for
   symmetry with Dart. The plan argues for the union.

Decided already: the reactive core stays `Rx` with explicit `observer.watch` (section 1.5); package names are `subtree.js`, `trunk.js`, `operation-result.js`.
Everything else in this plan can start without further input.
