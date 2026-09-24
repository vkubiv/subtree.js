# trunk.js

Application structure for apps built on `subtree.js`: the trunk the subtrees grow from.
No React. Peer dependency: `operation-result.js`.

```
npm i trunk.js operation-result.js
```

## `pick`

Narrow a dependencies object to the keys a flow or page declares. Structural typing
already lets a superset be passed where a subset is expected; `pick` makes the
narrowing real at runtime so a flow cannot reach what it did not declare.

```ts
export interface AppDeps { authStorage: AuthStorage; loggedinUser: LoggedinUser; backendApi: MerchantClient; /* ... */ }
export type SignInFlowDeps = Pick<AppDeps, "authStorage" | "loggedinUser" | "backendApi">;

const flowDeps = pick(appDeps, "authStorage", "loggedinUser", "backendApi");
```

A page that needs something the flow does not export takes it as an explicit field:

```ts
export type OtpDeps = Pick<SignInFlowDeps, "authStorage" | "loggedinUser"> & { signingInUser: SigningInUser };
```

## `AppError` and `ApiNotAuthorized`

`AppError` is the base for expected-error classes: it sets `name` from the subclass and
keeps an optional `cause`. `ApiNotAuthorized` is the one error `trunk.js` defines itself,
because `AuthHandler` needs to recognise it. Your transport layer maps a 401 to it.

```ts
export class InvalidFormField extends AppError {
  constructor(readonly field: string, readonly details: string, cause?: unknown) {
    super(`Invalid field ${field}: ${details}`, cause);
  }
}
```

## `AuthHandler`

Wraps authenticated calls that return a `Result`. It asks the provider for a context
(token) per call; when the result carries an auth error it hands a `PendingCall` to the
host, which re-authenticates and then calls `retry()` or `cancel()`. The original
caller's promise resolves with the retried result, or, on cancel, with the auth-failed
result it would have received without the handler. No exceptions, no hanging promises.

```ts
const authHandler = new AuthHandler<ApiContext>({
  provider: loggedinUser,                                  // { authorizeCall(): Promise<ApiContext> }
  onAuthFailure: (call) => reauthFlow.start({ onDone: () => call.retry(), onGiveUp: () => call.cancel() }),
  onLogout: () => loggedinUser.reset(),
  // isAuthFailure: (e) => e instanceof MyClientUnauthorized,   // when the client has its own 401 class
});

const r = await authHandler.callApi((ctx) => api.user.me(ctx));
```

The function given to `callApi` is re-run from the start after re-authentication, so it
is one call, or a block that is safe to replay. Several writes are several `callApi`s,
each retried on its own:

```ts
const results = await Promise.all(ids.map((id) => authHandler.callApi((ctx) => api.scans.reject(ctx, id))));
```

`isAuthFailure` decides which error in a failed result means "not authenticated". The
default is `instanceof ApiNotAuthorized`; a backend client with its own 401 class sets it.

Three ways to call the backend, all valid:

- `authHandler.callApi(...)` for user-facing reads and writes that should survive a 401.
- `loggedinUser.authorizeCall()` directly, for background or best-effort work that
  handles auth failure itself (falls back to cached data, for example).
- `loggedinUser.authorizeCall()` also for a stream, or anything that is not a `Result`:
  there is no single answer to retry, so the op takes the provider, not the handler.

An op names what it uses as separate fields, next to its repositories:
`{ client, authHandler, ... }` or `{ client, loggedinUser, ... }`. No `Api` object bundling
the client with the handler, and no `withSession` helper in front of `callApi`: the field
an op declares says which of the three it does.

## Conventions this package supports

- **Deps**: one interface per app root, `Pick`s per page (and per flow, when there is
  one), explicit extra fields.
- **Routing**: a plain object of navigation callbacks given to a controller. Controllers
  never import the router.
- **Pages and flows**: a page is a model, a controller and a view under `src/pages/<page>/`,
  with its routes in `app.tsx`. A flow is a multi-page sequence with state of its own
  (sign-in with OTP, onboarding): a component under `src/flows/<flow>/` that wires its
  pages to nested routes, builds each page's deps with `pick` and its routing from the
  router, and owns the per-flow state. An app whose pages are independent screens has one
  primary flow and no `flows/` folder.

The full description is in
[`docs/ARCHITECTURE.md`](https://github.com/vkubiv/subtree.js/blob/master/docs/ARCHITECTURE.md)
of the repository; [`docs/AI_INSTRUCTIONS.md`](https://github.com/vkubiv/subtree.js/blob/master/docs/AI_INSTRUCTIONS.md)
is the condensed manual for an app's `CLAUDE.md`, and
[`examples/login`](https://github.com/vkubiv/subtree.js/tree/master/examples/login) shows
`AuthHandler` with a re-authentication page and parked calls.
