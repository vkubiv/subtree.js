import { describe, expect, it, vi } from "vitest";
import { ReactiveBlock } from "./reactive-block";
import { Rx } from "./rx";

describe("ReactiveBlock", () => {
  it("runs now and again when a watched value changes", () => {
    const a = new Rx(1);
    const b = new Rx(2);
    const sum = new Rx(0);
    const runs = vi.fn();
    const block = new ReactiveBlock((ref) => {
      runs();
      sum.value = ref.watch(a) + ref.watch(b);
    });
    expect(sum.value).toBe(3);
    a.value = 10;
    expect(sum.value).toBe(12);
    b.value = 5;
    expect(sum.value).toBe(15);
    expect(runs).toHaveBeenCalledTimes(3);
    block.dispose();
    a.value = 0;
    expect(sum.value).toBe(15);
    expect(a.hasListeners).toBe(false);
  });

  it("subscribes to a source only once even if watched repeatedly", () => {
    const a = new Rx(1);
    const runs = vi.fn();
    const block = new ReactiveBlock((ref) => {
      runs();
      ref.watch(a);
      ref.watch(a);
    });
    a.value = 2;
    expect(runs).toHaveBeenCalledTimes(2);
    block.dispose();
  });

  it("picks up sources watched conditionally on later runs", () => {
    const flag = new Rx(false);
    const detail = new Rx("x");
    const seen: string[] = [];
    const block = new ReactiveBlock((ref) => {
      if (ref.watch(flag)) seen.push(ref.watch(detail));
    });
    detail.value = "y"; // not watched yet
    expect(seen).toEqual([]);
    flag.value = true;
    expect(seen).toEqual(["y"]);
    detail.value = "z";
    expect(seen).toEqual(["y", "z"]);
    block.dispose();
  });
});
