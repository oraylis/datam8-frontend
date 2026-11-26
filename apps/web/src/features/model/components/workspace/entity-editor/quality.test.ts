import { describe, expect, it } from "vitest";
import { parseQualityArguments, qualityErrors } from "./quality";

describe("fixed SQL quality contract", () => {
  const check = {
    id: "required",
    execution: "enforcement",
    expression: "Id IS NOT NULL",
  };
  it("accepts row checks, windows, aggregates and entity references", () => {
    for (const quality of [
      { checks: [] },
      { checks: [check], maxFailureRatePct: 0 },
      {
        checks: [
          {
            ...check,
            expression: "Id IS NULL OR COUNT(*) OVER (PARTITION BY Id) = 1",
          },
        ],
      },
      {
        checks: [
          {
            ...check,
            execution: "monitoring",
            sql: "SELECT COUNT(*) AS checked_rows, COUNT(*) AS measured_value FROM {target}",
            expression: "measured_value > 0",
            severity: "warning",
            onEmpty: "no_data",
          },
        ],
        references: { allowed: { entityId: 12 } },
      },
    ])
      expect(qualityErrors(quality)).toEqual([]);
  });
  it("rejects obsolete and unknown fields without compatibility", () => {
    for (const field of ["definition", "type", "parameters"])
      expect(
        qualityErrors({ checks: [{ ...check, [field]: {} }] }).length,
      ).toBeGreaterThan(0);
    for (const field of ["settings", "referenceDatasets", "unknown"])
      expect(
        qualityErrors({ checks: [check], [field]: {} }).length,
      ).toBeGreaterThan(0);
  });
  it("validates IDs and all field combinations", () => {
    for (const patch of [
      { id: "bad id" },
      { execution: "other" },
      { expression: " \n" },
      { expression: 1 },
      { severity: "warn" },
      { severity: null },
      { description: 2 },
      { sql: "SELECT 1" },
      { onEmpty: "evaluate" },
      { execution: "monitoring", sql: " " },
      { execution: "monitoring", sql: "SELECT 1", onEmpty: "skip" },
    ])
      expect(
        qualityErrors({ checks: [{ ...check, ...patch }] }).length,
      ).toBeGreaterThan(0);
    expect(qualityErrors({ checks: [check, check] }).join()).toContain(
      "unique",
    );
  });
  it("rejects coercion and nonfinite percentages and malformed references", () => {
    for (const maxFailureRatePct of [-1, 101, true, "5", null, Infinity, NaN])
      expect(
        qualityErrors({ checks: [], maxFailureRatePct }).length,
      ).toBeGreaterThan(0);
    for (const binding of [
      {},
      { entityId: true },
      { entityId: "12" },
      { entityId: -1 },
      { entityId: 1, table: "x" },
    ])
      expect(
        qualityErrors({ checks: [], references: { allowed: binding } }).length,
      ).toBeGreaterThan(0);
    expect(
      qualityErrors({
        checks: [],
        references: { "bad alias": { entityId: 1 } },
      }).length,
    ).toBeGreaterThan(0);
  });
  it("leaves SQL capability and resolution checks to the solution", () => {
    expect(
      qualityErrors({
        checks: [
          { ...check, expression: "unsupported SQL is checked by the target" },
        ],
      }),
    ).toEqual([]);
  });
  it("accepts opaque native functions and validates only their structure", () => {
    const native = {
      id: "native",
      execution: "enforcement",
      function: "future_function",
    };
    for (const rule of [
      native,
      { ...native, arguments: {} },
      {
        ...native,
        arguments: { column: "Id", nested: [null, true, 0, 2.5, "text", {}] },
      },
      {
        ...native,
        execution: "monitoring",
        sql: "SELECT 1",
        onEmpty: "no_data",
      },
    ])
      expect(qualityErrors({ checks: [rule] })).toEqual([]);
    for (const rule of [
      { ...native, expression: "Id > 0" },
      { id: "missing", execution: "enforcement" },
      { ...check, arguments: {} },
      { ...native, function: " " },
      { ...native, function: null },
      { ...native, arguments: [] },
      { ...native, arguments: null },
    ])
      expect(qualityErrors({ checks: [rule] }).length).toBeGreaterThan(0);
  });
});

describe("native argument JSON integrity", () => {
  it("rejects numeric rounding, overflow and underflow at any depth", () => {
    for (const token of [
      "9007199254740993",
      "-9007199254740993",
      "1e400",
      "1e-400",
      "1.0000000000000001",
      "0.1234567890123456789",
    ])
      expect(() =>
        parseQualityArguments(`{"nested": [{"limit": ${token}}]}`),
      ).toThrow("loss of precision");
  });
  it("preserves ordinary JSON values and equivalent decimal notation", () => {
    expect(
      parseQualityArguments(
        '{"limit": 9007199254740991, "nested": [null, false, 0.1000, 1e3, -2.5e-3], "text": "9007199254740993 \\\" 1e400"}',
      ),
    ).toEqual({
      limit: Number.MAX_SAFE_INTEGER,
      nested: [null, false, 0.1, 1000, -0.0025],
      text: '9007199254740993 " 1e400',
    });
  });
  it("reports malformed JSON and non-object arguments separately", () => {
    expect(() => parseQualityArguments("{")).toThrow("valid JSON");
    for (const text of ["[]", "null", "3"])
      expect(() => parseQualityArguments(text)).toThrow("JSON object");
  });
  it("blocks unsafe numeric values already loaded into a native check", () => {
    for (const limit of [Number.MAX_SAFE_INTEGER + 1, Infinity, -Infinity, NaN])
      expect(
        qualityErrors({
          checks: [
            {
              id: "native",
              execution: "enforcement",
              function: "future_function",
              arguments: { nested: [{ limit }] },
            },
          ],
        }).join(),
      ).toContain("loss of precision");
  });
});
