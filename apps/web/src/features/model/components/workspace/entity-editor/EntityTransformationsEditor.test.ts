import { describe, expect, it } from "vitest";
import { shouldDeleteFunctionSourceOnStepRemove } from "./EntityTransformationsEditor";

describe("shouldDeleteFunctionSourceOnStepRemove", () => {
  it("returns true when no other step references the same source", () => {
    const transformations = [
      { kind: "function", function: { source: "Step1.py" } },
      { kind: "builtin" },
      { kind: "function", function: { source: "Step2.py" } },
    ];

    expect(shouldDeleteFunctionSourceOnStepRemove(transformations, 0, "Step1.py")).toBe(true);
  });

  it("returns false when another step still references the same source", () => {
    const transformations = [
      { kind: "function", function: { source: "Shared.py" } },
      { kind: "function", function: { source: "Shared.py" } },
    ];

    expect(shouldDeleteFunctionSourceOnStepRemove(transformations, 0, "Shared.py")).toBe(false);
  });

  it("ignores surrounding whitespace for source comparison", () => {
    const transformations = [
      { kind: "function", function: { source: " Step1.py " } },
      { kind: "function", function: { source: "Step1.py" } },
    ];

    expect(shouldDeleteFunctionSourceOnStepRemove(transformations, 0, "Step1.py")).toBe(false);
  });
});
