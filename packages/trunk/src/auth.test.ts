import { type AsyncResult, describeErrors, fail, hasError, ok, unwrap } from "operation-result.js";
import { describe, expect, it, vi } from "vitest";
import { AuthHandler, type PendingCall } from "./auth";
import { ApiNotAuthorized, AppError } from "./errors";

class NotFound extends AppError {
  constructor() {
    super("404");
  }
}
interface Ctx {
  token: string;
}

function setup() {
  let token = "expired";
  const provider = { authorizeCall: vi.fn(async (): Promise<Ctx> => ({ token })) };
  const pending: PendingCall[] = [];
  const onLogout = vi.fn();
  const handler = new AuthHandler<Ctx>({
    provider,
    onAuthFailure: (call) => pending.push(call),
    onLogout,
  });
  const api = vi.fn(async (ctx: Ctx): AsyncResult<string, ApiNotAuthorized | NotFound> => {
    return ctx.token === "fresh" ? ok(`hello with ${ctx.token}`) : fail(new ApiNotAuthorized());
  });
  return { handler, provider, pending, api, onLogout, refresh: () => (token = "fresh") };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

const settled = <T>(p: Promise<T>) => {
  let done = false;
  void p.then(() => {
    done = true;
  });
  return () => done;
};

describe("AuthHandler.callApi", () => {
  it("passes a successful result straight through", async () => {
    const s = setup();
    s.refresh();
    const r = await s.handler.callApi(s.api);
    expect(unwrap(r)).toBe("hello with fresh");
    expect(s.pending).toHaveLength(0);
    expect(s.provider.authorizeCall).toHaveBeenCalledTimes(1);
  });

  it("passes non-auth failures straight through", async () => {
    const s = setup();
    const r = await s.handler.callApi(async () => fail(new NotFound()));
    expect(hasError(r, NotFound)).toBe(true);
    expect(s.pending).toHaveLength(0);
  });

  it("on an auth error, waits for the host and resolves with the retried result", async () => {
    const s = setup();
    const promise = s.handler.callApi(s.api);
    const isDone = settled(promise);
    await flush();
    expect(s.pending).toHaveLength(1);
    expect(isDone()).toBe(false);

    s.refresh();
    expect(await s.pending[0]!.retry()).toBe(true);
    expect(unwrap(await promise)).toBe("hello with fresh");
    expect(s.provider.authorizeCall).toHaveBeenCalledTimes(2);
    expect(s.api).toHaveBeenCalledTimes(2);
  });

  it("a retry that fails auth again asks the host again and reports false", async () => {
    const s = setup();
    const promise = s.handler.callApi(s.api);
    await flush();
    expect(await s.pending[0]!.retry()).toBe(false);
    expect(s.pending).toHaveLength(2);
    expect(s.pending[1]).toBe(s.pending[0]);
    s.refresh();
    expect(await s.pending[1]!.retry()).toBe(true);
    expect((await promise).ok).toBe(true);
  });

  it("cancel hands the auth-failed result back to the caller as a plain Result", async () => {
    const s = setup();
    const promise = s.handler.callApi(s.api);
    await flush();
    s.pending[0]!.cancel();
    const r = await promise;
    expect(hasError(r, ApiNotAuthorized)).toBe(true);
    // retry after cancel is a no-op that reports success (already settled)
    expect(await s.pending[0]!.retry()).toBe(true);
    expect(s.api).toHaveBeenCalledTimes(1);
  });

  it("logout forwards to onLogout", () => {
    const s = setup();
    s.handler.logout();
    expect(s.onLogout).toHaveBeenCalledTimes(1);
  });
});

describe("AppError", () => {
  class ValidationError extends AppError {
    constructor(
      readonly field: string,
      cause?: unknown,
    ) {
      super(`invalid ${field}`, cause);
    }
  }

  it("sets name from the subclass and keeps the cause", () => {
    const cause = new Error("root");
    const e = new ValidationError("f", cause);
    expect(e.name).toBe("ValidationError");
    expect(e.cause).toBe(cause);
    expect(e).toBeInstanceOf(Error);
    expect(e.stack).toBeDefined();
  });

  it("ApiNotAuthorized has a default message and keeps the cause", () => {
    const e = new ApiNotAuthorized();
    expect(e).toBeInstanceOf(AppError);
    expect(describeErrors([e])).toBe("ApiNotAuthorized: Not authorized");
    expect(new ApiNotAuthorized("401", "raw").cause).toBe("raw");
  });
});
