/**
 * A `Result<T, E>` is the outcome of an operation whose expected failures are
 * declared in its type. `E` is a union of error classes:
 *
 * ```ts
 * async function login(...): AsyncResult<Session, InvalidCredentials | EmailNotConfirmed>
 * ```
 *
 * Expected failures are values (`fail(...)`). Unexpected ones are exceptions and
 * must `throw`, so they reach the crash reporter instead of being handled as if
 * they were business outcomes.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Failed<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E> = Ok<T> | Failed<E>;

/** An `AsyncResult` is already a `Promise`; never wrap it in another one. */
export type AsyncResult<T, E> = Promise<Result<T, E>>;

/** Extracts the success type of a Result. */
export type ValueOf<R> = R extends Ok<infer T> ? T : never;
/** Extracts the error union of a Result. */
export type ErrorOf<R> = R extends Failed<infer E> ? E : never;

export function ok(): Result<void, never>;
export function ok<T>(value: T): Result<T, never>;
export function ok<T>(value?: T): Result<T | undefined, never> {
  return { ok: true, value };
}

/** A failed result carrying one or more errors. At least one is required. */
export function fail<E>(error: E, ...more: E[]): Result<never, E> {
  return { ok: false, errors: [error, ...more] };
}

/** A failed result from a non-empty list of errors (e.g. several validation errors). */
export function fails<E>(errors: readonly E[]): Result<never, E> {
  if (errors.length === 0) {
    throw new Error("fails() needs at least one error; use ok() for a successful result");
  }
  return { ok: false, errors: [...errors] };
}

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isFailed<T, E>(r: Result<T, E>): r is Failed<E> {
  return !r.ok;
}

// biome-ignore lint/suspicious/noExplicitAny: matches any constructor signature
export type Ctor<E> = abstract new (...args: any[]) => E;

/** True if the result failed with at least one error of the given class. */
export function hasError<E>(r: Result<unknown, unknown>, cls: Ctor<E>): boolean {
  return !r.ok && r.errors.some((e) => e instanceof cls);
}

/** True if the result failed with exactly one error, and it is of the given class. */
export function hasSingleError<E>(r: Result<unknown, unknown>, cls: Ctor<E>): boolean {
  return !r.ok && r.errors.length === 1 && r.errors[0] instanceof cls;
}

/** First error of the given class, or undefined. */
export function getError<E>(r: Result<unknown, unknown>, cls: Ctor<E>): E | undefined {
  if (r.ok) return undefined;
  return r.errors.find((e): e is E => e instanceof cls);
}

/** Every error of the given class, in order. Empty when the result succeeded. */
export function getErrors<E>(r: Result<unknown, unknown>, cls: Ctor<E>): E[] {
  if (r.ok) return [];
  return r.errors.filter((e): e is E => e instanceof cls);
}

/** Thrown by `unwrap` / `ensureSuccess` when a failed result is read as a success. */
export class UnhandledErrors extends Error {
  constructor(readonly errors: readonly unknown[]) {
    super(`Unhandled expected errors:\n${describeErrors(errors)}`);
    this.name = "UnhandledErrors";
  }
}

/**
 * Value of a successful result. Throws `UnhandledErrors` if it failed.
 * Use only after every member of `E` has been handled.
 */
export function unwrap<T>(r: Result<T, unknown>): T {
  if (!r.ok) throw new UnhandledErrors(r.errors);
  return r.value;
}

/** Narrows `r` to `Ok<T>`; throws `UnhandledErrors` otherwise. */
export function ensureSuccess<T, E>(r: Result<T, E>): asserts r is Ok<T> {
  if (!r.ok) throw new UnhandledErrors(r.errors);
}

/**
 * Transform a result into the shape a caller declares. `success` maps the value,
 * `failure` maps each error into the target union. A `failure` mapper that meets
 * an error it cannot translate should `throw`: that error was unexpected here.
 *
 * ```ts
 * return forward(r, (json) => parse(Profile, json), (e) => {
 *   if (e instanceof ValidationError) return new InvalidFormField(e.field, e.message, e);
 *   return e; // ApiNotAuthorized passes through unchanged
 * });
 * ```
 */
export function forward<T, U, E1, E2>(
  r: Result<T, E1>,
  success: (value: T) => U,
  failure: (error: E1) => E2,
): Result<U, E2> {
  if (r.ok) return ok(success(r.value));
  return { ok: false, errors: r.errors.map(failure) };
}

/** Map the success value; errors pass through unchanged. */
export function mapValue<T, U, E>(r: Result<T, E>, f: (value: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

/** Map each error; the success value passes through unchanged. */
export function mapErrors<T, E1, E2>(r: Result<T, E1>, f: (error: E1) => E2): Result<T, E2> {
  return r.ok ? r : { ok: false, errors: r.errors.map(f) };
}

/** One line per error: `Name: message` for `Error` instances, `String(e)` otherwise. */
export function describeErrors(errors: readonly unknown[]): string {
  return errors.map((e) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))).join("\n");
}
