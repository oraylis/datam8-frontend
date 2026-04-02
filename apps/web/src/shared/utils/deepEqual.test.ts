import { describe, expect, it } from "vitest";
import { deepEqual } from "./deepEqual";

describe("deepEqual", () => {
  it("matches primitives and nulls", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual("1", 1)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });

  it("compares nested objects and arrays", () => {
    const a = {
      id: 1,
      tags: ["x", "y"],
      nested: { enabled: true, levels: [1, 2, 3] },
    };
    const b = {
      id: 1,
      tags: ["x", "y"],
      nested: { enabled: true, levels: [1, 2, 3] },
    };
    expect(deepEqual(a, b)).toBe(true);
  });

  it("detects differences in nested arrays", () => {
    const a = { rows: [{ name: "a" }, { name: "b" }] };
    const b = { rows: [{ name: "a" }, { name: "c" }] };
    expect(deepEqual(a, b)).toBe(false);
  });
});
