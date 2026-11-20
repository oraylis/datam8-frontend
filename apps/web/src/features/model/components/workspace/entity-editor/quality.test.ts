import { describe, expect, it } from "vitest";
import { qualityErrors } from "./quality";

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
    for (const field of [
      "definition",
      "type",
      "function",
      "arguments",
      "parameters",
    ])
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
});
