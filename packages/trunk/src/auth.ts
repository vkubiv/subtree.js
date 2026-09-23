import type { AsyncResult, Result } from "operation-result.js";
import { ApiNotAuthorized } from "./errors";

/** Supplies the per-call context (a token, a session id). `LoggedinUser` implements it. */
export interface AuthContextProvider<Ctx> {
  authorizeCall(): Promise<Ctx>;
}

/**
 * A call that failed with an auth error and is waiting for the host to decide.
 * The host re-authenticates and then calls `retry()`, or gives up with `cancel()`.
 */
export interface PendingCall {
  /** Re-run the call with a fresh context. Resolves `true` if it went through, `false` if auth failed again (and `onAuthFailure` was invoked again). */
  retry(): Promise<boolean>;
  /** Give up: the original caller receives the auth-failed result it would have received without the handler. */
  cancel(): void;
}

export interface AuthHandlerOptions<Ctx> {
  provider: AuthContextProvider<Ctx>;
  /** Called when a call failed with `ApiNotAuthorized`. Drive re-auth, then `call.retry()` or `call.cancel()`. */
  onAuthFailure: (call: PendingCall) => void;
  onLogout?: () => void;
}

/**
 * The state of one authenticated call. Created by `AuthHandler.callApi`; only
 * `retry`/`cancel` are exposed to the host through `PendingCall`.
 */
export class AuthenticatedCall<Ctx, T, E> implements PendingCall {
  readonly #fn: (ctx: Ctx) => AsyncResult<T, E>;
  readonly #options: AuthHandlerOptions<Ctx>;
  #lastFailure: Result<T, E> | null = null;
  #resolve!: (r: Result<T, E>) => void;
  #settled = false;
  readonly #outcome: Promise<Result<T, E>>;

  constructor(fn: (ctx: Ctx) => AsyncResult<T, E>, options: AuthHandlerOptions<Ctx>) {
    this.#fn = fn;
    this.#options = options;
    this.#outcome = new Promise<Result<T, E>>((resolve) => {
      this.#resolve = resolve;
    });
  }

  /** First attempt. On an auth error, hands itself to `onAuthFailure` and waits. */
  async execute(): Promise<Result<T, E>> {
    const result = await this.#attempt();
    if (this.#isAuthFailure(result)) {
      this.#lastFailure = result;
      this.#options.onAuthFailure(this);
      return this.#outcome;
    }
    return result;
  }

  async retry(): Promise<boolean> {
    if (this.#settled) return true;
    const result = await this.#attempt();
    if (this.#isAuthFailure(result)) {
      this.#lastFailure = result;
      this.#options.onAuthFailure(this);
      return false;
    }
    this.#settle(result);
    return true;
  }

  cancel(): void {
    if (this.#settled || this.#lastFailure === null) return;
    this.#settle(this.#lastFailure);
  }

  async #attempt(): Promise<Result<T, E>> {
    const ctx = await this.#options.provider.authorizeCall();
    return this.#fn(ctx);
  }

  #isAuthFailure(result: Result<T, E>): boolean {
    return !result.ok && result.errors.some((e) => e instanceof ApiNotAuthorized);
  }

  #settle(result: Result<T, E>): void {
    this.#settled = true;
    this.#resolve(result);
  }
}

/**
 * Wraps authenticated API calls. `callApi` injects the context from the provider;
 * when the result carries an `ApiNotAuthorized` error it invokes `onAuthFailure` with a
 * `PendingCall` and resolves the caller's promise only after `retry()` succeeds
 * or `cancel()` hands back the failed result.
 *
 * ```ts
 * const r = await authHandler.callApi((ctx) => api.user.me(ctx));
 * ```
 */
export class AuthHandler<Ctx> {
  readonly #options: AuthHandlerOptions<Ctx>;

  constructor(options: AuthHandlerOptions<Ctx>) {
    this.#options = options;
  }

  callApi<T, E>(fn: (ctx: Ctx) => AsyncResult<T, E>): AsyncResult<T, E> {
    return new AuthenticatedCall<Ctx, T, E>(fn, this.#options).execute();
  }

  logout(): void {
    this.#options.onLogout?.();
  }
}
