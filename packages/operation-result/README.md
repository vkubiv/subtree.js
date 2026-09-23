# operation-result.js

Typed expected errors for TypeScript. The port of the Dart package
[`operation_result`](https://pub.dev/packages/operation_result), with a union type
instead of numbered `ErrorsN`.

```
npm i operation-result.js
```

## Why

Comments such as `// throws Unauthorized, InvalidFormField` rot. Declare the expected
failures in the return type instead, and let the compiler make callers handle them:

```ts
async function editProfile(data: EditProfile): AsyncResult<Profile, Unauthorized | InvalidFormField>
```

Expected failures are values. Unexpected ones (network down, a bug) are exceptions:
`throw`, and let the crash reporter see them.

## API

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };
type AsyncResult<T, E> = Promise<Result<T, E>>;   // already a Promise: never wrap it

ok(value)   ok()                 // success
fail(e, ...more)   fails(list)   // failure with one or more errors (never empty)

r.ok                             // narrow with the discriminant...
isOk(r)   isFailed(r)            // ...or with guards
hasError(r, Cls)                 // failed with at least one error of that class
hasSingleError(r, Cls)           // failed with exactly that one error
getError(r, Cls)                 // first error of that class, or undefined
getErrors(r, Cls)                // every error of that class
unwrap(r)                        // value, or throws UnhandledErrors
ensureSuccess(r)                 // asserts r is Ok<T>

forward(r, success, failure)     // map the value and each error into a new shape
mapValue(r, f)   mapErrors(r, f)
describeErrors(errors)           // "Name: message" per line
```

Errors are classes so `instanceof` works and a stack trace exists. Any class will do;
`trunk.js` ships an `AppError` base that sets `name` and keeps `cause`:

```ts
export class InvalidFormField extends Error {
  override readonly name = "InvalidFormField";
  constructor(readonly field: string, readonly details: string, cause?: unknown) {
    super(`Invalid field ${field}: ${details}`, { cause });
  }
}
```

## Patterns

**Translate at the boundary.** An API method turns transport errors into the errors it
declares. The mapper must return a member of the declared union, so a new transport
error breaks the build until every method takes a position on it.

```ts
async me(ctx: ApiContext): Promise<Result<UserProfile, ApiNotAuthorized>> {
  const r = await this.transport.get(ctx, "/user/me");
  return forward(r, (json) => parse(UserProfile, json), (e) => {
    if (e instanceof ValidationError) throw new UnexpectedApiError(e); // never expected here
    return e;                                                          // ApiNotAuthorized
  });
}
```

**Pass through unchanged.** `forward(r, (v) => v, (e) => e)` or `mapErrors(r, (e) => e)`.

**Handle in a controller.** Check the errors that change the UI, treat the rest as a
generic failure, return early, and only then read the value.

```ts
const r = await signIn({ otp, ...deps });
if (hasError(r, InvalidOtp)) { state.isError.value = true; return; }
if (!r.ok) { state.errorMessage.value = t("login.error"); return; }
routing.onSignedIn(r.value);
```

**Several errors of one kind.** `getErrors(r, InvalidFormField)` for validation lists.

**Wrapping a throwing API.** Catch only what you can map to a declared error; rethrow the
rest.

## Differences from the Dart package

| Dart | TypeScript |
|---|---|
| `Errors2<A, B>` | `A \| B` |
| `success2(v)` / `failure2(e)` / `failures2(list)` | `ok(v)` / `fail(e)` / `fails(list)` |
| `forward2(success:, failure:)` | `forward(r, success, failure)` |
| `result.value` throws `AssertionError` | `unwrap(r)` throws `UnhandledErrors` |
| runtime check that errors are expected | compile-time: the union |
