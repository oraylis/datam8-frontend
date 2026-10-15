import { describe, expect, it } from "vitest";
import { compactErrorMessage, readBackendErrorMessage } from "./errorMessage";

describe("readBackendErrorMessage", () => {
  it("returns the API message unchanged and prefers it over detail", () => {
    const message = "  Backend failed\nwhile reading the source  ";
    expect(readBackendErrorMessage({ message, detail: "Details" }, "Fallback")).toBe(message);
  });

  it("reads detail when message is absent", () => {
    expect(readBackendErrorMessage({ detail: "FastAPI detail" }, "Fallback")).toBe("FastAPI detail");
  });

  it("reads error when message and detail are absent", () => {
    expect(readBackendErrorMessage({ error: "File was not found" }, "Fallback")).toBe("File was not found");
  });

  it("uses fallback when the response has no recognized message", () => {
    expect(readBackendErrorMessage({ code: "unexpected" }, "Failed with HTTP 500")).toBe("Failed with HTTP 500");
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
