import { describe, expect, it } from "vitest";
import { applyBulkAttributeEditRules, getAttributeIdsInRange, getDuplicateBulkAttributeEditFields, type BulkAttributeEditRule } from "./bulkAttributeEdit";
import type { EntityAttribute } from "./types";

describe("applyBulkAttributeEditRules", () => {
  it("applies multiple rules only to selected attributes", () => {
    const attributes: EntityAttribute[] = [
      {
        __uiId: "a-1",
        name: "SalesOrderId",
        dataType: { type: "int", nullable: true },
        isBusinessKey: false,
        history: "SCD1",
      },
      {
        __uiId: "a-2",
        name: "CustomerId",
        dataType: { type: "string", nullable: true },
        isBusinessKey: false,
        history: "",
      },
      {
        __uiId: "a-3",
        name: "Ignored",
        dataType: { type: "decimal", nullable: false },
        isBusinessKey: false,
      },
    ];
    const rules: BulkAttributeEditRule[] = [
      { id: "rule-1", field: "nullable", value: false },
      { id: "rule-2", field: "history", value: "" },
      { id: "rule-3", field: "dataType", value: "bigint" },
    ];

    const result = applyBulkAttributeEditRules(attributes, new Set(["a-1", "a-2"]), rules);

    expect(result[0]).toMatchObject({
      dataType: { type: "bigint", nullable: false },
      history: "",
      __modified: true,
    });
    expect(result[1]).toMatchObject({
      dataType: { type: "bigint", nullable: false },
      history: "",
      __modified: true,
    });
    expect(result[2]).toBe(attributes[2]);
  });

  it("keeps new attributes unmarked while still applying the edits", () => {
    const attributes: EntityAttribute[] = [
      {
        __uiId: "a-1",
        name: "NewAttribute",
        __isNew: true,
        __modified: false,
        unit: "",
      },
    ];

    const result = applyBulkAttributeEditRules(
      attributes,
      new Set(["a-1"]),
      [{ id: "rule-1", field: "unit", value: "EUR" }],
    );

    expect(result[0]).toMatchObject({
      unit: "EUR",
      __isNew: true,
      __modified: false,
    });
  });

  it("does not create new objects when rules do not change a value", () => {
    const attribute: EntityAttribute = {
      __uiId: "a-1",
      name: "CustomerId",
      dataType: { type: "int", nullable: true },
      isBusinessKey: false,
    };

    const result = applyBulkAttributeEditRules(
      [attribute],
      new Set(["a-1"]),
      [
        { id: "rule-1", field: "nullable", value: true },
        { id: "rule-2", field: "isBusinessKey", value: false },
      ],
    );

    expect(result[0]).toBe(attribute);
  });

  it("adds, updates and removes column properties", () => {
    const attributes: EntityAttribute[] = [
      {
        __uiId: "a-1",
        name: "CustomerId",
        properties: [{ property: "PII", value: "yes" }],
      },
      {
        __uiId: "a-2",
        name: "CustomerName",
        properties: [],
      },
    ];

    const added = applyBulkAttributeEditRules(
      attributes,
      new Set(["a-2"]),
      [{ id: "rule-1", field: "property", propertyName: "Classification", value: "gold" }],
    );
    expect(added[1].properties).toEqual([{ property: "Classification", value: "gold" }]);

    const updated = applyBulkAttributeEditRules(
      attributes,
      new Set(["a-1"]),
      [{ id: "rule-1", field: "property", propertyName: "PII", value: "no" }],
    );
    expect(updated[0].properties).toEqual([{ property: "PII", value: "no" }]);

    const removed = applyBulkAttributeEditRules(
      attributes,
      new Set(["a-1"]),
      [{ id: "rule-1", field: "property", propertyName: "PII", value: "" }],
    );
    expect(removed[0].properties).toEqual([]);
  });
});

describe("bulk attribute edit helpers", () => {
  it("returns all attribute ids in a shift-selection range", () => {
    const attributes: EntityAttribute[] = [
      { __uiId: "a-1", name: "One" },
      { __uiId: "a-2", name: "Two" },
      { __uiId: "a-3", name: "Three" },
      { __uiId: "a-4", name: "Four" },
    ];

    expect(Array.from(getAttributeIdsInRange(attributes, "a-2", "a-4"))).toEqual(["a-2", "a-3", "a-4"]);
    expect(Array.from(getAttributeIdsInRange(attributes, "a-4", "a-2"))).toEqual(["a-2", "a-3", "a-4"]);
  });

  it("detects duplicate field rules", () => {
    const duplicates = getDuplicateBulkAttributeEditFields([
      { id: "rule-1", field: "nullable", value: false },
      { id: "rule-2", field: "unit", value: "EUR" },
      { id: "rule-3", field: "nullable", value: true },
    ]);

    expect(Array.from(duplicates)).toEqual(["nullable"]);
  });

  it("uses property name in duplicate detection for column properties", () => {
    const duplicates = getDuplicateBulkAttributeEditFields([
      { id: "rule-1", field: "property", propertyName: "PII", value: "yes" },
      { id: "rule-2", field: "property", propertyName: "Classification", value: "gold" },
      { id: "rule-3", field: "property", propertyName: "PII", value: "no" },
    ]);

    expect(Array.from(duplicates)).toEqual(["property:PII"]);
  });
});
