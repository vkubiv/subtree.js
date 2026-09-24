# operation-result.js: the Result pattern

Type-safe results for expected API and operation errors. Forces explicit handling of
known failure modes at compile time, without exceptions. The TypeScript port of the Dart
package `operation_result`, with a union type instead of numbered `ErrorsN`.

## Core idea

Instead of `throws` comments that rot:

```ts
// Throws Unauthorized, InvalidFormField
async function editProfile(data: EditProfile): Promise<Profile> { ... }
```

declare the errors in the return type:

```ts
async function editProfile(data: EditProfile): AsyncResult<Profile, Unauthorized | InvalidFormField> { ... }
```

`AsyncResult<T, E>` is already a `Promise`. Never wrap it in another one.

Expected failures are values. Unexpected ones (network down, a bug) are exceptions:
`throw`, and let the crash reporter see them.

## API reference

```ts
type Ok<T>      = { readonly ok: true;  readonly value: T };
type Failed<E>  = { readonly ok: false; readonly errors: readonly E[] };
type Result<T, E> = Ok<T> | Failed<E>;
type AsyncResult<T, E> = Promise<Result<T, E>>;
type ValueOf<R>, ErrorOf<R>       // extract T and E from a Result type
```

Constructors:

```ts
ok(value)          ok()          // success (ok() for void)
fail(e, ...more)                 // failure with one or more errors
fails(list)                      // failure from a non-empty list (throws on empty)
```

Reading:

```ts
r.ok                             // the discriminant: narrow with if (!r.ok) ...
isOk(r)   isFailed(r)            // type guards
r.errors                         // readonly E[] once narrowed to failed
hasError(r, Cls)                 // failed with at least one error of that class
hasSingleError(r, Cls)           // failed with exactly one error, of that class
getError(r, Cls)                 // first error of that class, or undefined
getErrors(r, Cls)                // every error of that class (empty when ok)
unwrap(r)                        // value, or throws UnhandledErrors
ensureSuccess(r)                 // asserts r is Ok<T>; throws UnhandledErrors
```

Transforming:

```ts
forward(r, success, failure)     // map the value and each error into a new shape
mapValue(r, f)                   // map the value; errors pass through
mapErrors(r, f)                  // map each error; value passes through
describeErrors(errors)           // "Name: message" per line, for messages and logs
```

`Cls` is any constructor, abstract ones included: `hasError(r, AppError)` matches every
subclass.

## Error classes

Errors are classes, so `instanceof` works and a stack trace exists when one is ever
thrown. Any class will do. `trunk.js` provides `AppError`, which sets `name` from the
subclass and keeps an optional `cause`, and `ApiNotAuthorized`, the error
`AuthHandler` recognises:

```ts
import { AppError } from "trunk.js";

export class InvalidCredentials extends AppError {
  constructor() { super("Login or password is incorrect"); }
}
export class InvalidFormField extends AppError {
  constructor(readonly field: string, readonly details: string, cause?: unknown) {
    super(`Invalid field ${field}: ${details}`, cause);
  }
}
```

## Patterns

### 1. Pass errors through unchanged

An op calls another op and propagates any failure as is:

```ts
export async function syncNotes(o: {...}): AsyncResult<Note[], ApiNotAuthorized | NoNetwork> {
  const r = await o.authHandler.callApi((ctx) => o.api.notes.sync(ctx));
  if (!r.ok) return r;                       // Failed<ApiNotAuthorized | NoNetwork> is assignable
  // ... process r.value
  return ok(notes);
}
```

When the target union differs, `forward(r, (v) => v, (e) => e)` or `mapErrors(r, (e) => e)`
make the compiler check that every error of `r` belongs to it.

### 2. Check a specific error, then use the value

```ts
const settings = await syncSettings(o);
if (hasError(settings, SettingsNotFound)) return fail(new OpNotAllowedOffline());
if (!settings.ok) return settings;           // nothing else was declared, but narrow anyway
const accepted = settings.value.termsAccepted;
```

### 3. Map one error into another

```ts
const profile = await o.api.user.me(ctx);
if (hasError(profile, ApiNotAuthorized)) return fail(new ExpiredCredentials());
```

### 4. Translate at the boundary with `forward`

An API method turns transport errors into the errors it declares. The failure mapper
must return a member of the declared union, so a new transport error breaks the build
until every method takes a position on it. A mapper that meets an error it cannot
translate should `throw`: that error was unexpected there.

```ts
async me(ctx: ApiContext): AsyncResult<UserProfile, ApiNotAuthorized> {
  const r = await this.transport.get(ctx, "/user/me");
  return forward(r, (json) => parse(UserProfile, json), (e) => {
    if (e instanceof ValidationError) throw new UnexpectedApiError(e);
    return e;                                                    // ApiNotAuthorized
  });
}
```

### 5. Handle in a controller

Check the errors that change the UI, treat the rest as a generic failure, return early,
and only then read the value:

```ts
const r = await signIn({ username, password, ...this.deps });
if (!r.ok) {
  this.state.failed.emit(hasError(r, InvalidCredentials) ? "Login or password is incorrect" : describeErrors(r.errors));
  return;
}
this.routing.onSignedIn();
```

### 6. Several errors of one kind

```ts
const fieldErrors = getErrors(r, InvalidFormField);
if (fieldErrors.length > 0) {
  for (const e of fieldErrors) form.setError(e.field, e.details);
  return;
}
```

### 7. `unwrap` when every declared error was handled

`unwrap(r)` returns the value or throws `UnhandledErrors`, which is not caught locally:
it propagates to the crash reporter. Use it only after handling every member of `E`, or
in tests. Never call it as the first thing on a result.

## Wrapping a throwing API

Catch only what maps to a declared error; rethrow the rest.

```ts
async function fcmToken(messaging: Messaging): AsyncResult<string | null, NoNetwork> {
  try {
    return ok(await messaging.getToken());
  } catch (e) {
    if (isOfflineError(e)) return fail(new NoNetwork(e));
    throw e;                                   // unexpected: let the crash reporter see it
  }
}
```

## What this package is not for

- A generic exception replacement: use `try/catch` for unexpected errors.
- Infrastructure errors (a null dereference, a stack overflow): let them throw.
- Errors the caller cannot act on: if there is nothing to do with an error, do not
  declare it; let it throw and be reported.

## Differences from the Dart package

| Dart | TypeScript |
|---|---|
| `Errors2<A, B>` | `A \| B` |
| `success2(v)` / `failure2(e)` / `failures2(list)` | `ok(v)` / `fail(e)` / `fails(list)` |
| `result.failed` | `!r.ok` |
| `result.hasError<E>()` | `hasError(r, E)` |
| `forward2(success:, failure:)` | `forward(r, success, failure)` |
| `result.value` throws `AssertionError` | `unwrap(r)` throws `UnhandledErrors`; `r.value` exists only after narrowing |
| runtime check that errors are expected | compile time: the union |
