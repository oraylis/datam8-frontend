import { describe, expect, it } from "vitest";
import { qualityErrors } from "./quality";

describe("tool-neutral quality", () => {
  const check = { id: "rule", execution: "monitoring", definition: {} };
  it("accepts unrelated dialects, target options and nulls without DQX assumptions", () => {
    for (const definition of [
      { check: { function: "future", arguments: [null] } },
      { assertion: { expression: "Id > 0" }, level: "fatal", nullable: null },
      {
        check: "not a DQX object",
        user_metadata: { datam8_check_id: "opaque" },
      },
      {},
    ]) {
      expect(
        qualityErrors({
          checks: [{ ...check, definition }],
          settings: { dependencies: { other: true } },
          referenceDatasets: {
            file: { uri: "memory://fixture", nullable: null },
          },
        }),
      ).toEqual([]);
    }
  });
  it("validates common structure, IDs, percentages and reference metadata", () => {
    expect(
      qualityErrors({ checks: [check], settings: { maxFailureRatePct: 0 } }),
    ).toEqual([]);
    for (const quality of [
      { checks: [check, check] },
      { checks: [{ ...check, definition: [] }] },
      { checks: [{ ...check, type: "dqx" }] },
      { checks: [{ ...check, execution: "unknown" }] },
      { checks: [check], settings: { maxFailureRatePct: -1 } },
      { checks: [check], referenceDatasets: { file: { entityId: true } } },
      { checks: [check], referenceDatasets: null },
    ])
      expect(qualityErrors(quality).length).toBeGreaterThan(0);
  });
  it("rejects non-JSON values but does not interpret function names or expressions", () => {
    expect(
      qualityErrors({
        checks: [
          {
            ...check,
            definition: { expression: "invalid SQL is a target concern" },
          },
        ],
      }),
    ).toEqual([]);
    expect(
      qualityErrors({
        checks: [{ ...check, definition: { limit: Infinity } }],
      }).join(),
    ).toContain("finite JSON");
    expect(
      qualityErrors({
        checks: [{ ...check, definition: { callback: () => true } }],
      }).join(),
    ).toContain("finite JSON");
  });
});
