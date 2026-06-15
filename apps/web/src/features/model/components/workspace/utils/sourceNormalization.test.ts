import { describe, expect, it } from "vitest";
import { normalizeMappingForSave } from "./sourceNormalization";

describe("normalizeMappingForSave", () => {
  it("drops blank mapping rows", () => {
    expect(
      normalizeMappingForSave([
        {
          sourceName: "",
          targetName: "   ",
          sourceDataType: { charLen: "   ", precision: "", scale: null },
          properties: [{ property: " ", value: "" }],
        },
      ]),
    ).toEqual([]);
  });

  it("does not normalize whitespace-only numeric fields to zero", () => {
    expect(
      normalizeMappingForSave([
        {
          sourceName: "source_id",
          targetName: "id",
          sourceDataType: { type: "string", nullable: true, charLen: "   " },
        },
      ]),
    ).toEqual([
      {
        sourceName: "source_id",
        targetName: "id",
        sourceDataType: { type: "string", nullable: true },
      },
    ]);
  });

  it("trims names and properties while preserving valid numeric fields", () => {
    expect(
      normalizeMappingForSave([
        {
          sourceName: " source_id ",
          targetName: " id ",
          sourceDataType: { type: "decimal", nullable: false, precision: "10", scale: "2" },
          properties: [{ property: " domain ", value: " sales " }],
        },
      ]),
    ).toEqual([
      {
        sourceName: "source_id",
        targetName: "id",
        sourceDataType: { type: "decimal", nullable: false, precision: 10, scale: 2 },
        properties: [{ property: "domain", value: "sales" }],
      },
    ]);
  });
});
