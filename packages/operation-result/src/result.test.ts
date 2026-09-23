import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type AsyncResult,
  describeErrors,
  ensureSuccess,
  fail,
  fails,
  forward,
  getError,
  getErrors,
  hasError,
  hasSingleError,
  isFailed,
  isOk,
  mapErrors,
  mapValue,
  ok,
  type Result,
  UnhandledErrors,
  unwrap,
} from "./result";

class NotAuthorized extends Error {
  override readonly name = "NotAuthorized";
  constructor() {
    super("not authorized");
  }
}
class ValidationError extends Error {
  override readonly name = "ValidationError";
  constructor(
    readonly field: string,
    cause?: unknown,
  ) {
    super(`invalid ${field}`, { cause });
  }
}
class InvalidFormField extends Error {
  override readonly name = "InvalidFormField";
  constructor(
    readonly field: string,
    cause?: unknown,
  ) {
    super(`form field ${field}`, { cause });
  }
}

describe("constructors", () => {
  it("ok wraps a value and ok() a void", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
    expect(ok()).toEqual({ ok: true, value: undefined });
    expectTypeOf(r).toEqualTypeOf<Result<number, never>>();
    expectTypeOf(ok()).toEqualTypeOf<Result<void, never>>();
  });

  it("fail needs at least one error; fails rejects an empty list", () => {
    const r = fail(new NotAuthorized());
    expect(r.ok).toBe(false);
    expect(isFailed(r) && r.errors).toHaveLength(1);
    expect(fails([new ValidationError("a"), new ValidationError("b")])).toMatchObject({ ok: false });
    expect(() => fails([])).toThrow(/at least one error/);
    expectTypeOf(r).toEqualTypeOf<Result<never, NotAuthorized>>();
  });

  it("a Result<T, never> is assignable to any declared error union", () => {
    const r: Result<number, NotAuthorized | ValidationError> = ok(1);
    expect(r.ok).toBe(true);
  });
});

describe("reading", () => {
  const failed: Result<string, NotAuthorized | ValidationError> = fails([
    new ValidationError("email"),
    new ValidationError("phone"),
  ]);
  const succeeded: Result<string, NotAuthorized | ValidationError> = ok("hi");

  it("hasError / hasSingleError filter by class", () => {
    expect(hasError(failed, ValidationError)).toBe(true);
    expect(hasError(failed, NotAuthorized)).toBe(false);
    expect(hasError(succeeded, ValidationError)).toBe(false);
    expect(hasSingleError(failed, ValidationError)).toBe(false);
    expect(hasSingleError(fail(new NotAuthorized()), NotAuthorized)).toBe(true);
    expect(hasSingleError(fail(new NotAuthorized()), Error)).toBe(true);
  });

  it("getError / getErrors return typed instances", () => {
    const first = getError(failed, ValidationError);
    expectTypeOf(first).toEqualTypeOf<ValidationError | undefined>();
    expect(first?.field).toBe("email");
    expect(getErrors(failed, ValidationError).map((e) => e.field)).toEqual(["email", "phone"]);
    expect(getErrors(succeeded, ValidationError)).toEqual([]);
    expect(getError(failed, NotAuthorized)).toBeUndefined();
  });

  it("isOk / isFailed narrow", () => {
    if (isOk(succeeded)) expectTypeOf(succeeded.value).toEqualTypeOf<string>();
    if (isFailed(failed))
      expectTypeOf(failed.errors).toEqualTypeOf<readonly (NotAuthorized | ValidationError)[]>();
    expect(isOk(succeeded)).toBe(true);
    expect(isFailed(failed)).toBe(true);
  });

  it("unwrap returns the value or throws UnhandledErrors listing them", () => {
    expect(unwrap(succeeded)).toBe("hi");
    expect(() => unwrap(failed)).toThrow(UnhandledErrors);
    try {
      unwrap(failed);
    } catch (e) {
      expect(e).toBeInstanceOf(UnhandledErrors);
      expect((e as UnhandledErrors).errors).toHaveLength(2);
      expect((e as Error).message).toContain("ValidationError: invalid email");
    }
  });

  it("ensureSuccess narrows or throws", () => {
    ensureSuccess(succeeded);
    expectTypeOf(succeeded.value).toEqualTypeOf<string>();
    expect(() => ensureSuccess(failed)).toThrow(UnhandledErrors);
  });
});

describe("forwarding", () => {
  type Transport = Result<unknown, NotAuthorized | ValidationError>;

  function toProfile(r: Transport): Result<{ name: string }, NotAuthorized | InvalidFormField> {
    return forward(
      r,
      (json) => ({ name: String((json as { name: string }).name) }),
      (e) => {
        if (e instanceof ValidationError) return new InvalidFormField(e.field, e);
        return e;
      },
    );
  }

  it("maps the value on success", () => {
    const r = toProfile(ok({ name: "Ann" }));
    expect(r).toEqual({ ok: true, value: { name: "Ann" } });
  });

  it("maps each error on failure and keeps causes", () => {
    const r = toProfile(fails([new ValidationError("a"), new ValidationError("b")]));
    const errors = getErrors(r, InvalidFormField);
    expect(errors.map((e) => e.field)).toEqual(["a", "b"]);
    expect(errors[0]?.cause).toBeInstanceOf(ValidationError);
  });

  it("passes untouched errors through", () => {
    const r = toProfile(fail(new NotAuthorized()));
    expect(hasError(r, NotAuthorized)).toBe(true);
  });

  it("the failure mapper must return a member of the declared union", () => {
    const r: Transport = fail(new NotAuthorized());
    // @ts-expect-error: NotAuthorized is not assignable to InvalidFormField
    const bad: Result<string, InvalidFormField> = forward(r, String, (e) => e);
    expect(bad.ok).toBe(false);
  });

  it("a failure mapper may throw for an error it never expects", () => {
    const r: Transport = fail(new ValidationError("x"));
    expect(() =>
      forward(r, String, (e) => {
        if (e instanceof NotAuthorized) return e;
        throw new Error(`unexpected ${e.name}`);
      }),
    ).toThrow(/unexpected ValidationError/);
  });

  it("mapValue and mapErrors change one side only", () => {
    const r: Result<number, NotAuthorized> = ok(2);
    expect(mapValue(r, (v) => v * 2)).toEqual({ ok: true, value: 4 });
    const f: Result<number, NotAuthorized> = fail(new NotAuthorized());
    expect(mapValue(f, (v) => v * 2)).toBe(f);
    expect(mapErrors(r, () => new ValidationError("x"))).toBe(r);
    expect(
      hasError(
        mapErrors(f, () => new ValidationError("x")),
        ValidationError,
      ),
    ).toBe(true);
  });
});

describe("AsyncResult", () => {
  async function login(user: string): AsyncResult<{ token: string }, NotAuthorized> {
    if (user !== "ann") return fail(new NotAuthorized());
    return ok({ token: "t" });
  }

  it("is a plain Promise of a Result", async () => {
    const good = await login("ann");
    const bad = await login("bob");
    expect(unwrap(good).token).toBe("t");
    expect(hasError(bad, NotAuthorized)).toBe(true);
  });
});

describe("describeErrors", () => {
  it("prints one line per error", () => {
    expect(describeErrors([new NotAuthorized(), "plain", 3])).toBe("NotAuthorized: not authorized\nplain\n3");
  });
});
