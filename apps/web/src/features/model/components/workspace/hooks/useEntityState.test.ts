import { describe, expect, it } from "vitest";
import {
  normalizeOptionalStringField,
  normalizeRelationshipsForSave,
  normalizeSourcesForSave,
  resetAttributeSaveMarkers,
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

describe("normalizeRelationshipsForSave", () => {
  it("drops relationships without target or without complete mappings", () => {
    const result = normalizeRelationshipsForSave([
      { targetModelEntityId: 12, mappings: [{ source: "CustomerId", target: "" }] },
      { targetModelEntityId: null, mappings: [{ source: "A", target: "B" }] },
      { targetModelEntityId: 44, mappings: [{ source: "OrderId", target: "Id" }] },
      { dataSource: "crm", targetLocation: "", mappings: [{ source: "CustomerId", target: "Id" }] },
      { dataSource: "crm", targetLocation: "dbo.Customer", mappings: [{ source: "CustomerId", target: "Id" }] },
    ]);

    expect(result).toEqual([
      { targetModelEntityId: 44, mappings: [{ source: "OrderId", target: "Id" }] },
      { dataSource: "crm", targetLocation: "dbo.Customer", mappings: [{ source: "CustomerId", target: "Id" }] },
    ]);
  });

  it("serializes external relationships to canonical attributes", () => {
    const result = serializeEntityContent({
      baseContent: { id: 1, name: "Order" },
      formValues: { name: "Order" },
      attributes: [],
      sources: [],
      relationships: [
        {
          dataSource: "crm",
          targetLocation: "dbo.Customer",
          alias: "Customer",
          mappings: [{ source: "CustomerId", target: "Id" }],
        },
      ],
      transformations: [],
      properties: [],
    });

    expect(result.relationships).toEqual([
      {
        dataSource: "crm",
        targetLocation: "dbo.Customer",
        alias: "Customer",
        attributes: [{ sourceName: "CustomerId", targetName: "Id" }],
      },
    ]);
  });
});

describe("normalizeSourcesForSave", () => {
  it("drops incomplete sources and keeps complete internal and external sources", () => {
    const result = normalizeSourcesForSave([
      { sourceLocation: "" },
      { sourceLocation: 42, mapping: [{ sourceName: "A", targetName: "" }, { sourceName: "B", targetName: "C" }] },
      { dataSource: "crm", sourceLocation: "" },
      { dataSource: "crm", sourceLocation: "dbo.Customer", mapping: [{ sourceName: "Id", targetName: "CustomerId" }] },
    ]);

    expect(result).toEqual([
      { sourceLocation: 42, mapping: [{ sourceName: "B", targetName: "C" }] },
      { dataSource: "crm", sourceLocation: "dbo.Customer", mapping: [{ sourceName: "Id", targetName: "CustomerId" }] },
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

describe("resetAttributeSaveMarkers", () => {
  it("keeps attribute ui ids stable and only resets save markers", () => {
    const clean = { name: "Id", __uiId: "row-1", __isNew: false, __modified: false };
    const changed = { name: "Description", __uiId: "row-2", __isNew: true, __modified: true };
    const result = resetAttributeSaveMarkers([clean, changed]);

    expect(result[0]).toBe(clean);
    expect(result[1]).toEqual({ name: "Description", __uiId: "row-2", __isNew: false, __modified: false });
  });
});
