import { describe, expect, it } from "vitest";
import { buildAttributesFromExternalSourceSchema } from "./externalSchemaAdoption";

describe("buildAttributesFromExternalSourceSchema", () => {
  it("maps source data types to canonical data types via effective mappings", () => {
    const attributes = buildAttributesFromExternalSourceSchema({
      source: {
        mapping: [
          {
            targetName: "CustomerId",
            sourceName: "CustomerId",
            sourceDataType: { type: "int", nullable: false },
          },
        ],
      },
      dataSourceDetail: {
        dataSourceType: {
          dataTypeMapping: [{ sourceType: "int", targetType: "int64" }],
        },
      },
      canonicalDataTypes: ["string", "int64", "date"],
      defaultAttributeType: "Regular",
      nowIso: "2026-04-13T10:00:00.000Z",
    });

    expect(attributes).toHaveLength(1);
    expect(attributes[0]).toMatchObject({
      name: "CustomerId",
      attributeType: "Regular",
      dataType: { type: "int64", nullable: false },
      dateAdded: "2026-04-13T10:00:00.000Z",
    });
  });

  it("lets source-specific dataTypeMapping override inherited type mappings", () => {
    const attributes = buildAttributesFromExternalSourceSchema({
      source: {
        mapping: [
          {
            targetName: "CustomerId",
            sourceName: "CustomerId",
            sourceDataType: { type: "int", nullable: true },
          },
        ],
      },
      dataSourceDetail: {
        dataTypeMapping: [{ sourceType: "int", targetType: "string" }],
        dataSourceType: {
          dataTypeMapping: [{ sourceType: "int", targetType: "int64" }],
        },
      },
      canonicalDataTypes: ["string", "int64"],
      defaultAttributeType: "Regular",
      nowIso: "2026-04-13T10:00:00.000Z",
    });

    expect(attributes).toHaveLength(1);
    expect(attributes[0]?.dataType?.type).toBe("string");
  });

  it("skips mapping rows without targetName or sourceDataType.type", () => {
    const attributes = buildAttributesFromExternalSourceSchema({
      source: {
        mapping: [
          {
            targetName: "ValidColumn",
            sourceName: "ValidColumn",
            sourceDataType: { type: "nvarchar", nullable: true, charLen: 200 },
          },
          {
            targetName: "",
            sourceName: "NoTarget",
            sourceDataType: { type: "int", nullable: false },
          },
          {
            targetName: "NoType",
            sourceName: "NoType",
            sourceDataType: { nullable: false },
          },
        ],
      },
      dataSourceDetail: {},
      canonicalDataTypes: ["string", "int64"],
      defaultAttributeType: "Regular",
      nowIso: "2026-04-13T10:00:00.000Z",
    });

    expect(attributes).toHaveLength(1);
    expect(attributes[0]?.name).toBe("ValidColumn");
  });

  it("falls back to canonical string when no mapping matches", () => {
    const attributes = buildAttributesFromExternalSourceSchema({
      source: {
        mapping: [
          {
            targetName: "Comment",
            sourceName: "Comment",
            sourceDataType: { type: "weird_text", nullable: true, charLen: 512 },
          },
        ],
      },
      dataSourceDetail: {},
      canonicalDataTypes: ["string", "int64"],
      defaultAttributeType: "Regular",
      nowIso: "2026-04-13T10:00:00.000Z",
    });

    expect(attributes).toHaveLength(1);
    expect(attributes[0]).toMatchObject({
      name: "Comment",
      dataType: {
        type: "string",
        nullable: true,
        charLen: 512,
      },
    });
  });
});

