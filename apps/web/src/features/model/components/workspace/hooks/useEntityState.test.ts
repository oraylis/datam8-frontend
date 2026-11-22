import { describe, expect, it } from "vitest";
import {
  normalizeOptionalStringField,
  normalizeRelationshipsForSave,
  normalizeSourcesForSave,
  serializeEntityContent,
} from "./useEntityState";

const serialize = (overrides: Partial<Parameters<typeof serializeEntityContent>[0]> = {}) =>
  serializeEntityContent({
    baseContent: { id: 1, name: "Customer", displayName: "Customer" },
    formValues: { name: "Customer", displayName: "Customer" },
    attributes: [],
    sources: [],
    relationships: [],
    transformations: [],
    properties: [],
    ...overrides,
  });

describe("serializeEntityContent", () => {
  it("omits an absent description and preserves an explicit clear", () => {
    const absent = serialize({
      baseContent: { id: 1, name: "Customer", displayName: "Customer" },
      formValues: { name: "Customer", displayName: "Customer", description: undefined },
    });
    expect(Object.hasOwn(absent, "description")).toBe(false);

    const cleared = serialize({
      baseContent: { id: 1, name: "Customer", displayName: "Customer", description: "Old" },
      formValues: { name: "Customer", displayName: "Customer", description: "" },
    });
    expect(cleared.description).toBe("");
  });

  it("keeps function source and excludes editor-only and read-only fields", () => {
    const result = serialize({
      baseContent: { id: 1, name: "Customer", effectiveProperties: [{ property: "write_mode", value: "merge" }] },
      transformations: [
        { kind: "function", name: "Transform", function: { source: "transform.py" }, __uiPrevFunctionSource: "old.py" },
        { kind: "builtin", name: "Aggregate", function: { source: "should-not-save.py" } },
      ],
    });

    expect(Object.hasOwn(result, "effectiveProperties")).toBe(false);
    expect(result.transformations).toEqual([
      { kind: "function", name: "Transform", function: { source: "transform.py" }, stepNo: 1 },
      { kind: "builtin", name: "Aggregate", stepNo: 2 },
    ]);
  });
});

describe("normalizeRelationshipsForSave", () => {
  it("drops incomplete links and serializes complete model and external links", () => {
    const normalized = normalizeRelationshipsForSave([
      { targetModelEntityId: 12, mappings: [{ source: "CustomerId", target: "" }] },
      { targetModelEntityId: null, mappings: [{ source: "A", target: "B" }] },
      { targetModelEntityId: 44, mappings: [{ source: "OrderId", target: "Id" }] },
      { dataSource: "crm", targetLocation: "", mappings: [{ source: "CustomerId", target: "Id" }] },
      { dataSource: "crm", targetLocation: "dbo.Customer", mappings: [{ source: "CustomerId", target: "Id" }] },
    ]);

    expect(serialize({ relationships: normalized }).relationships).toEqual([
      { targetLocation: 44, attributes: [{ sourceName: "OrderId", targetName: "Id" }] },
      {
        dataSource: "crm",
        targetLocation: "dbo.Customer",
        attributes: [{ sourceName: "CustomerId", targetName: "Id" }],
      },
    ]);
  });
});

describe("normalizeSourcesForSave", () => {
  it("drops incomplete sources and retains valid locations and metadata", () => {
    expect(normalizeSourcesForSave([
      { sourceLocation: "" },
      { sourceLocation: 42, mapping: [{ sourceName: "A", targetName: "" }, { sourceName: "B", targetName: "C" }] },
      { dataSource: "crm", sourceLocation: "" },
      { dataSource: "crm", sourceLocation: "dbo.Customer", metadataLocation: "contracts/customer", mapping: [{ sourceName: "Id", targetName: "CustomerId" }] },
      { dataSource: "crm", sourceLocation: "dbo.Orders", metadataLocation: "" },
    ])).toEqual([
      { sourceLocation: 42, mapping: [{ sourceName: "B", targetName: "C" }] },
      { dataSource: "crm", sourceLocation: "dbo.Customer", metadataLocation: "contracts/customer", mapping: [{ sourceName: "Id", targetName: "CustomerId" }] },
      { dataSource: "crm", sourceLocation: "dbo.Orders" },
    ]);
  });
});

describe("normalizeOptionalStringField", () => {
  it.each([
    ["sql", "sql"],
    ["   ", undefined],
    [12, undefined],
    [null, undefined],
  ])("normalizes optional string value %s", (value, expected) => {
    expect(normalizeOptionalStringField(value)).toBe(expected);
  });
});
