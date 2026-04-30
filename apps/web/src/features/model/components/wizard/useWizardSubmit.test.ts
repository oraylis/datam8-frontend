import { describe, expect, it } from "vitest";
import type { PropertyAssignment } from "@datam8/types";
import { mapMetadataColumnToCreatedAttribute } from "./useWizardSubmit";

describe("mapMetadataColumnToCreatedAttribute", () => {
  it("maps optional column description and properties to created attributes", () => {
    const properties: PropertyAssignment[] = [{ property: "classification", value: "restricted" }];
    const result = mapMetadataColumnToCreatedAttribute({
      column: {
        name: "CustomerId",
        ordinal: 1,
        dataType: "string",
        maxLength: 50,
        numericPrecision: null,
        numericScale: null,
        isNullable: false,
        isPrimaryKey: true,
        description: "Business customer key",
        properties,
      },
      index: 0,
      nowIso: "2026-01-01T00:00:00.000Z",
      effectiveMappings: [],
      canonicalDataTypes: ["string", "int", "boolean"],
    });

    expect(result.name).toBe("CustomerId");
    expect(result.description).toBe("Business customer key");
    expect(result.properties).toEqual(properties);
    expect(result.isBusinessKey).toBe(true);
    expect(result.dataType.type).toBe("string");
  });
});

