import { describe, expect, it } from "vitest";
import { validatePassword, validateUsername } from "./credentials";

describe("credentials", () => {
  it("rejects an empty or blank username", () => {
    expect(validateUsername("")).not.toBeNull();
    expect(validateUsername("   ")).not.toBeNull();
    expect(validateUsername("alice")).toBeNull();
  });

  it("rejects an empty password", () => {
    expect(validatePassword("")).not.toBeNull();
    expect(validatePassword("x")).toBeNull();
  });
});
