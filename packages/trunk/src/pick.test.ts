import { describe, expect, expectTypeOf, it } from "vitest";
import { pick } from "./pick";

interface AppDeps {
  api: { name: string };
  storage: { kind: string };
  zero: number;
}
const app: AppDeps = { api: { name: "api" }, storage: { kind: "mem" }, zero: 0 };

describe("pick", () => {
  it("returns only the requested keys, by reference", () => {
    const flow = pick(app, "api", "zero");
    expect(flow).toEqual({ api: app.api, zero: 0 });
    expect(flow.api).toBe(app.api);
    expect("storage" in flow).toBe(false);
    expectTypeOf(flow).toEqualTypeOf<Pick<AppDeps, "api" | "zero">>();
  });

  it("a picked object satisfies a Pick-typed dependency shape", () => {
    type FlowDeps = Pick<AppDeps, "api">;
    const deps: FlowDeps = pick(app, "api");
    expect(deps.api.name).toBe("api");
  });

  it("rejects unknown keys at compile time and missing ones at runtime", () => {
    // @ts-expect-error: not a key of AppDeps
    expect(() => pick(app, "nope")).toThrow(/"nope" is missing/);
  });
});
