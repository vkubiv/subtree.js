import { describe, expect, expectTypeOf, it } from "vitest";
import { SubtreeModel, token } from "./model";

class State {
  n = 0;
}
abstract class Actions {
  abstract go(): void;
}
interface Api {
  call(): string;
}
const ApiToken = token<Api>("Api");

describe("SubtreeModel", () => {
  it("put returns the instance and get resolves it by class", () => {
    const m = new SubtreeModel();
    const s = m.put(State, new State());
    expect(m.get(State)).toBe(s);
    expectTypeOf(m.get(State)).toEqualTypeOf<State>();
  });

  it("resolves an implementation under an abstract class token", () => {
    const m = new SubtreeModel();
    const impl: Actions = { go() {} };
    m.put(Actions, impl);
    expect(m.get(Actions)).toBe(impl);
    expectTypeOf(m.get(Actions)).toEqualTypeOf<Actions>();
  });

  it("resolves an interface under a typed symbol token", () => {
    const m = new SubtreeModel();
    m.put(ApiToken, { call: () => "ok" });
    expect(m.get(ApiToken).call()).toBe("ok");
    expectTypeOf(m.get(ApiToken)).toEqualTypeOf<Api>();
  });

  it("keeps falsy instances", () => {
    const m = new SubtreeModel();
    const Zero = token<number>("Zero");
    const Empty = token<string>("Empty");
    m.put(Zero, 0);
    m.put(Empty, "");
    expect(m.get(Zero)).toBe(0);
    expect(m.get(Empty)).toBe("");
    expect(m.has(Zero)).toBe(true);
  });

  it("throws on duplicate put and on a missing get, naming the token", () => {
    const m = new SubtreeModel();
    m.put(State, new State());
    expect(() => m.put(State, new State())).toThrow(/already contains State/);
    expect(() => m.get(Actions)).toThrow(/Actions is not in the subtree model/);
    expect(() => m.get(ApiToken)).toThrow(/Api is not in the subtree model/);
    expect(m.has(Actions)).toBe(false);
  });

  it("type-checks the instance against the token", () => {
    const m = new SubtreeModel();
    // @ts-expect-error: a string is not a State
    m.put(State, "nope");
    // @ts-expect-error: wrong shape for Api
    m.put(ApiToken, { nope: 1 });
  });
});
