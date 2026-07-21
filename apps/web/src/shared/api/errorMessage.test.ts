import { describe, expect, it } from "vitest";
import { compactErrorMessage, readBackendErrorMessage } from "./errorMessage";

describe("readBackendErrorMessage", () => {
  it("reads message before detail", () => {
    expect(readBackendErrorMessage({ message: "Backend failed", detail: "Details" }, "Fallback")).toBe("Backend failed");
  });
});

describe("compactErrorMessage", () => {
  it("extracts the useful message from a rich python traceback", () => {
    const raw = [
      "+--------------------- Traceback (most recent call last) ---------------------+",
      "| C:\\repo\\submodules\\datam8-generator\\src\\datam8\\cmd\\root.py:273 in serve |",
      "| > 273     _ = factory.create_model()                                        |",
      "+-----------------------------------------------------------------------------+",
      "HTTPException: 500: ['Entity was not found in model: zones/030_serve']",
    ].join("\n");

    expect(compactErrorMessage(raw)).toBe("Entity was not found in model: zones/030_serve");
  });

  it("keeps a simple error readable", () => {
    expect(compactErrorMessage("Error: something failed")).toBe("something failed");
  });

  it("falls back to the last meaningful line", () => {
    expect(compactErrorMessage("first line\nsecond line")).toBe("second line");
  });

  it("uses fallback for empty input", () => {
    expect(compactErrorMessage("", "Fallback message")).toBe("Fallback message");
  });
});
