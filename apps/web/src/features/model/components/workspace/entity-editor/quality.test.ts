import { describe, expect, it } from "vitest";
import { qualityErrors, renameQualityAttribute } from "./quality";
import type { Quality } from "../../../generated-schema-types";

const attrs = [
  { name: "Id", dataType: { type: "int" } },
  { name: "Email", dataType: { type: "string" } },
];
const quality: Quality = {
  checks: [
    {
      id: "id_required",
      type: "not_null",
      attribute: "Id",
      execution: "enforcement",
      severity: "error",
    },
  ],
};
describe("entity quality", () => {
  it("validates references, identity and aggregate execution", () => {
    expect(qualityErrors(quality, attrs)).toEqual([]);
    expect(
      qualityErrors(
        { checks: [...quality.checks, ...quality.checks] },
        attrs,
      ).join(),
    ).toContain("unique");
    expect(qualityErrors(quality, [])).toHaveLength(1);
    expect(
      qualityErrors(
        {
          checks: [
            {
              id: "c",
              type: "completeness",
              attribute: "Email",
              execution: "enforcement",
              severity: "warning",
              parameters: { minCompleteness: 0.95 },
            },
          ],
        },
        attrs,
      ).join(),
    ).toContain("monitoring");
  });
  it("checks numeric bounds, zero thresholds, blank SQL and type compatibility", () => {
    expect(
      qualityErrors({ ...quality, settings: { maxFailureRatePct: 0 } }, attrs),
    ).toEqual([]);
    expect(
      qualityErrors(
        {
          checks: [
            {
              id: "c",
              type: "range",
              attribute: "Email",
              execution: "monitoring",
              severity: "error",
              parameters: { min: 2, max: 1 },
            },
          ],
        },
        attrs,
      ),
    ).toHaveLength(2);
    expect(
      qualityErrors(
        {
          checks: [
            {
              id: "c",
              type: "sql_expression",
              execution: "monitoring",
              severity: "error",
              parameters: { expression: " " },
            },
          ],
        },
        attrs,
      ),
    ).toHaveLength(1);
  });
  it("renames structured references without rewriting SQL", () => {
    const q: Quality = {
      checks: [
        ...quality.checks,
        {
          id: "sql",
          type: "sql_expression",
          execution: "monitoring",
          severity: "warning",
          parameters: { expression: "Id > 0" },
        },
      ],
    };
    const renamed = renameQualityAttribute(q, "Id", "Key")!;
    expect(renamed.checks[0]).toMatchObject({ attribute: "Key" });
    expect(renamed.checks[1]).toEqual(q.checks[1]);
    expect(q.checks[0]).toMatchObject({ attribute: "Id" });
  });
});
