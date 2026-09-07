import { describe, expect, it } from "vitest";
import { readValidateErrorMessage, readValidateMessages } from "./validatorApi";

describe("validatorApi", () => {
  it("extracts top-level message from error payload", () => {
    const message = readValidateErrorMessage({ message: "Validation failed." }, "fallback");
    expect(message).toBe("Validation failed.");
  });

  it("extracts detail when payload has no message", () => {
    const message = readValidateErrorMessage({ detail: "nope" }, "fallback");
    expect(message).toBe("nope");
  });

  it("reads validate messages from success payload", () => {
    const messages = readValidateMessages({ messages: ["line 1", "line 2"] });
    expect(messages).toEqual(["line 1", "line 2"]);
  });

  it("reads validate messages from error details payload", () => {
    const messages = readValidateMessages({ details: { messages: ["warn 1"] } });
    expect(messages).toEqual(["warn 1"]);
  });

  it("splits multiline and carriage-return messages into individual lines", () => {
    const messages = readValidateMessages({
      messages: ["line 1\r\nline 2\rline 3\nline 4"],
    });
    expect(messages).toEqual(["line 1", "line 2", "line 3", "line 4"]);
  });

  it("strips ansi escapes from messages", () => {
    const messages = readValidateMessages({
      messages: ["\u001b[31m[ERROR]\u001b[0m line"],
    });
    expect(messages).toEqual(["[ERROR] line"]);
  });

  it("reads logs from object-style payloads", () => {
    const messages = readValidateMessages({
      details: {
        logs: [{ message: "[INFO] datam8.validator | step 1" }, { text: "[INFO] datam8.validator | step 2" }],
      },
    });
    expect(messages).toEqual(["[INFO] datam8.validator | step 1", "[INFO] datam8.validator | step 2"]);
  });

  it("uses top-level message as a last-resort log line", () => {
    const messages = readValidateMessages({
      status: "ok",
      solutionPath: "/tmp/mock.dm8s",
      message: "Validation completed successfully.",
    });
    expect(messages).toEqual(["Validation completed successfully."]);
  });
});
