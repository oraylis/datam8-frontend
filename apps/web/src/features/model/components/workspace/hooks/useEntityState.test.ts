import { describe, expect, it } from "vitest";
import {
  hasIncompleteFormLinkageDraft,
  normalizeOptionalStringField,
  normalizeRelationshipsForSave,
  serializeEntityContent,
} from "./useEntityState";

describe("serializeEntityContent", () => {
  it("does not add description when both draft and base are undefined", () => {
    const result = serializeEntityContent({
      baseContent: { id: 2000, name: "Customer", displayName: "Customer" },
      formValues: { name: "Customer", displayName: "Customer", description: undefined },
      attributes: [],
      sources: [],
      relationships: [],
      transformations: [],
      properties: [],
    });

    expect(Object.prototype.hasOwnProperty.call(result, "description")).toBe(false);
  });

  it("keeps explicit empty description instead of falling back to base value", () => {
    const result = serializeEntityContent({
      baseContent: { id: 1, name: "Entity", displayName: "Entity", description: "old description" },
      formValues: { name: "Entity", displayName: "Entity", description: "" },
      attributes: [],
      sources: [],
      relationships: [],
      transformations: [],
      properties: [],
    });

    expect(result.description).toBe("");
  });

  it("removes temporary transformation ui fields", () => {
    const result = serializeEntityContent({
      baseContent: { id: 1, name: "Entity", displayName: "Entity" },
      formValues: { name: "Entity", displayName: "Entity" },
      attributes: [],
      sources: [],
      relationships: [],
      transformations: [
        {
          kind: "function",
          name: "transform",
          function: { source: "transform.py" },
          __uiPrevFunctionSource: "transform_old.py",
        },
      ],
      properties: [],
    });

    expect(result.transformations[0].__uiPrevFunctionSource).toBeUndefined();
    expect(result.transformations[0].function?.source).toBe("transform.py");
  });
});

describe("hasIncompleteFormLinkageDraft", () => {
  const zoneFromRelPath = (relPath: string | undefined) => {
    if (!relPath) return "";
    return relPath.split("/")[1] || "";
  };
  const inferSourceType = (src: any) =>
    src && Object.prototype.hasOwnProperty.call(src, "dataSource") ? "external" : "internal";

  it("returns true for incomplete internal source", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [{ sourceLocation: "" }],
      relationships: [],
      relationshipZones: {},
      modelEntities: [],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });

  it("returns true for incomplete external source", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [{ dataSource: "crm", sourceLocation: "" }],
      relationships: [],
      relationshipZones: {},
      modelEntities: [],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });

  it("returns true for relationship missing zone", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [],
      relationships: [{ targetModelEntityId: 12 }],
      relationshipZones: {},
      modelEntities: [],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });

  it("returns false when relationships and sources are complete", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [{ sourceLocation: 42 }],
      relationships: [{ targetModelEntityId: 12, mappings: [{ source: "CustomerId", target: "Id" }] }],
      relationshipZones: {},
      modelEntities: [{ relPath: "Model/Finance/Customer.json", content: { id: 12 }, name: "Customer" } as any],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(false);
  });

  it("returns true for relationship with partial mapping row", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [],
      relationships: [{ targetModelEntityId: 12, mappings: [{ source: "CustomerId", target: "" }] }],
      relationshipZones: {},
      modelEntities: [{ relPath: "Model/Finance/Customer.json", content: { id: 12 }, name: "Customer" } as any],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });

  it("returns true for relationship without any complete mapping", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [],
      relationships: [{ targetModelEntityId: 12, mappings: [] }],
      relationshipZones: {},
      modelEntities: [{ relPath: "Model/Finance/Customer.json", content: { id: 12 }, name: "Customer" } as any],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });

  it("returns true for source with partial mapping row", () => {
    const result = hasIncompleteFormLinkageDraft({
      sources: [{ sourceLocation: 42, mapping: [{ sourceName: "A", targetName: "" }] }],
      relationships: [],
      relationshipZones: {},
      modelEntities: [],
      zoneFromRelPath,
      inferSourceType,
    });

    expect(result).toBe(true);
  });
});

describe("normalizeRelationshipsForSave", () => {
  it("drops relationships without target or without complete mappings", () => {
    const result = normalizeRelationshipsForSave([
      { targetModelEntityId: 12, mappings: [{ source: "CustomerId", target: "" }] },
      { targetModelEntityId: null, mappings: [{ source: "A", target: "B" }] },
      { targetModelEntityId: 44, mappings: [{ source: "OrderId", target: "Id" }] },
    ]);

    expect(result).toEqual([
      { targetModelEntityId: 44, mappings: [{ source: "OrderId", target: "Id" }] },
    ]);
  });
});

describe("normalizeOptionalStringField", () => {
  it("keeps non-empty strings", () => {
    expect(normalizeOptionalStringField("sql")).toBe("sql");
  });

  it("drops empty strings", () => {
    expect(normalizeOptionalStringField("   ")).toBeUndefined();
  });

  it("drops non-string values", () => {
    expect(normalizeOptionalStringField(null)).toBeUndefined();
    expect(normalizeOptionalStringField(12)).toBeUndefined();
  });
});
