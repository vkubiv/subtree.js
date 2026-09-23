# Example: login

The port of `subtree/full_examples/flutter_login`, extended with the pieces the Flutter
example did not have: a backend-client that returns `Result` everywhere, `AuthHandler`
with re-authentication, flows, a section, and tests at every level. It is one of the two
acceptance tests of the architecture in [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

```
npm install            # at the repository root
npm run dev -w example-login
npm test  -w example-login
```

Any username signs in; the password `fail` is rejected. On the home page, "Expire session"
makes the demo server forget the token, and "Reload" then comes back with
`ApiNotAuthorized`: `AuthHandler` parks the call, the app shows the session-expired page,
and after the password is entered again the parked call finishes on its own.

## Layout

```
src/
  backend-client/         the API contract (interfaces, error classes) and DemoBackend
  core/
    auth/                 AuthStorage, LoggedinUser (session), PendingReauth (parked calls)
    repositories/         ProfileRepository
    ops/                  auth-ops (restoreSession, signIn, reauthenticate, signOut), profile-ops
    primitives/           validators
  app-deps.ts             AppDeps + createAppDeps(): everything built once
  app-controller.ts       root controller: restores the session, mirrors it into state
  app.tsx                 root routes: splash, sign-in flow, authenticated area
  flows/
    sign-in/              SignInFlow: LoginPage, SessionExpiredPage
    home/                 HomeFlow: HomePage with the ProfileSection
```

## What it demonstrates

| Rule | Where |
|---|---|
| Expected failures are values | `backend-client/index.ts` declares `AsyncResult<LoginResponse, InvalidCredentials>` and `AsyncResult<UserProfile, ApiNotAuthorized>`; ops forward them; controllers check them with `hasError`. |
| Controllers coordinate, Ops decide | `core/ops/auth-ops.ts`, `core/ops/profile-ops.ts`. Controllers call them and map results to state. |
| Repositories store and notify | `ProfileRepository` holds a discriminated-union status; the profile section `sync`s on it. |
| `AuthHandler` + re-auth | `createAppDeps` wires `onAuthFailure` to `PendingReauth`; `SessionExpiredController` calls `reauthenticate`, which signs in again and `retryAll()`s the parked calls; "Sign out" `cancelAll()`s them. |
| Deps by structural typing | `AppDeps` at the root, `Pick<...>` per flow and page, `pick()` at each boundary. |
| Navigation is a callback | Every controller takes a `Routing` object; only flows call `useNavigate`. |
| Sections | `HomeController` owns `ProfileSectionController` (a `BaseController` registered into the page's subtree). |
| Derived state | `ReactiveBlock` computes `canSubmit` in the login and session-expired controllers. |
| Events | `LoginState.failed` is an `RxEvent`; the page shows it with `useRxEvent`. |
| Route identity | Sibling routes give their `<Subtree>` a `key` (see `sign-in-flow.tsx`). |

## Tests

| Level | File | Shape |
|---|---|---|
| Ops | `core/ops/*.test.ts` | Real repositories, `DemoBackend`, no React. `profile-ops.test.ts` walks the whole park / retry / cancel story. |
| Controllers | `flows/**/*-controller.test.ts` | Fake deps, spy routing, drive actions, assert `state.x.value`. |
| Pages | `flows/**/*-page.test.tsx` | `<SubtreeProvider>` with a real state and mocked actions. |
| Flow | `app.test.tsx` | The app in a `MemoryRouter` with real deps, StrictMode on. |

The examples compile the packages from source (see `vite.config.ts` and `tsconfig.json`),
so they never run against a stale build. An app outside this repository just installs
`subtree.js`, `trunk.js` and `operation-result.js`.
