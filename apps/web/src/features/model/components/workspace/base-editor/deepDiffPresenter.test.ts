import { describe, expect, it } from "vitest";
import { groupAttributeChanges, groupExternalSourceChanges, presentDeepDiff, readableChangeFields, affectedChanges, readableChangeLabel } from "./deepDiffPresenter";

describe("presentDeepDiff", () => {
  it.each([
    ["root['properties'][0]['value']", "classification", "Properties › classification"],
    ["root['attributes'][0]['properties'][0]['value']", "business_name", "Properties › business_name"],
    ["root['sources'][0]['properties'][0]['value']", "extract_mode", "Properties › extract_mode"],
    ["root['sources'][0]['mapping'][0]['properties'][0]['value']", "type", "Properties › type"],
    ["root['sources'][0]['mapping'][0]['properties'][0]['value']['type']['name']", "format › type › name", "Properties › format › type › name"],
    ["root['sources'][0]['mapping'][0]['sourceDataType']['type']", "sourceDataType › type", "Data type"],
    ["root['attributes'][0]['dataType']['charLen']", "dataType › charLen", "Length"],
    ["root['attributes'][0]['description']", "classification", "classification"],
    ["root['parameters'][0]['value']['properties'][0]", "type", "Data type"],
  ])("labels properties by their schema path and preserves custom names: %s", (path, label, expected) => {
    const [entry] = presentDeepDiff({ values_changed: { [path]: { old_value: "old", new_value: "new" } } }, {}, {});
    expect(readableChangeLabel(entry, label)).toBe(expected);
  });

  it("counts 20 field changes as five modified affected objects, without counting new mapping properties as added sources", () => {
    const before = {
      attributes: Array.from({ length: 4 }, (_, index) => ({ name: `column_${index}`, dataType: { type: "string", charLen: 12 } })),
      sources: [{ sourceLocation: "campaign", mapping: Array.from({ length: 11 }, (_, index) => ({ sourceName: `column_${index}`, targetName: `column_${index}`, sourceDataType: { type: "string" }, properties: [] as unknown[] })) }],
    };
    const after = structuredClone(before);
    const values_changed: Record<string, unknown> = {};
    const iterable_item_added: Record<string, unknown> = {};
    after.attributes.forEach((attribute, index) => {
      attribute.dataType.charLen = 24;
      values_changed[`root['attributes'][${index}]['dataType']['charLen']`] = { old_value: 12, new_value: 24 };
    });
    after.sources[0].mapping.forEach((mapping, index) => {
      if (index < 6) {
        mapping.sourceDataType.type = "nvarchar";
        values_changed[`root['sources'][0]['mapping'][${index}]['sourceDataType']['type']`] = { old_value: "string", new_value: "nvarchar" };
      }
      if (index < 10) {
        const property = { property: "classification", value: "public" };
        mapping.properties.push(property);
        iterable_item_added[`root['sources'][0]['mapping'][${index}]['properties'][0]`] = property;
      }
    });
    const entries = presentDeepDiff({ values_changed, iterable_item_added }, before, after);
    expect(entries).toHaveLength(20);
    expect(affectedChanges(entries)).toHaveLength(5);
    expect(affectedChanges(entries).map((entry) => entry.operation)).toEqual(Array(5).fill("changed"));
  });

  it("counts whole new and removed objects separately while combining all fields of existing columns", () => {
    const before = { attributes: [{ name: "id", dataType: { type: "int", nullable: true } }], sources: [{ sourceAlias: "Legacy", sourceLocation: "old", mapping: [] }] };
    const after = { attributes: [{ name: "id", dataType: { type: "long", nullable: false } }, { name: "new_id", dataType: { type: "int", nullable: false } }], sources: [{ sourceAlias: "Archive", sourceLocation: "new", mapping: [{ sourceName: "id", targetName: "id" }] }] };
    const entries = presentDeepDiff({ values_changed: {
      "root['attributes'][0]['dataType']['type']": { old_value: "int", new_value: "long" },
      "root['attributes'][0]['dataType']['nullable']": { old_value: true, new_value: false },
    }, iterable_item_added: { "root['attributes'][1]": after.attributes[1], "root['sources'][0]": after.sources[0] },
      iterable_item_removed: { "root['sources'][0]": before.sources[0] },
    }, before, after);
    const operations = affectedChanges(entries).map((entry) => entry.operation);
    expect(operations).toHaveLength(4);
    expect(operations.filter((operation) => operation === "added")).toHaveLength(2);
    expect(operations.filter((operation) => operation === "changed")).toHaveLength(1);
    expect(operations.filter((operation) => operation === "removed")).toHaveLength(1);
  });
  const before = {
    attributes: [{ name: "dm_load_date", dataType: { type: "datetime" } }],
    properties: [{ property: "write_mode", value: "merge" }],
    sources: [{
      sourceLocation: "[dm_dom].[revenue]",
      mapping: [{ sourceName: "subscriber_id", targetName: "subscriber_id", properties: [] }],
    }],
  };
  const after = {
    attributes: [{ name: "dm_load_date", dataType: { type: "long" } }],
    properties: [{ property: "write_mode", value: "partition_replace" }],
    sources: [{
      sourceLocation: "[dm_dom].[revenue]",
      mapping: [{
        sourceName: "subscriber_id",
        targetName: "subscriber_id",
        properties: [{ property: "attribute_type", value: "bk" }],
      }],
    }],
  };

  it("presents changed values using the values returned by DeepDiff", () => {
    const entries = presentDeepDiff({
      values_changed: {
        "root['attributes'][0]['dataType']['type']": {
          old_value: "datetime",
          new_value: "long",
        },
        "root['properties'][0]['value']": {
          old_value: "merge",
          new_value: "partition_replace",
        },
      },
    }, before, after);

    expect(entries).toEqual([
      expect.objectContaining({
        group: "attributes",
        displayPath: "dm_load_date › dataType › type",
        before: "datetime",
        after: "long",
      }),
      expect.objectContaining({
        group: "entityProperties",
        displayPath: "write_mode",
        before: "merge",
        after: "partition_replace",
      }),
    ]);
  });

  it("keeps added mapping properties as one generator diff entry", () => {
    const entries = presentDeepDiff({
      iterable_item_added: {
        "root['sources'][0]['mapping'][0]['properties'][0]": {
          property: "attribute_type",
          value: "bk",
        },
      },
    }, before, after);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(expect.objectContaining({
      operation: "added",
      group: "mappings",
      displayPath: "[dm_dom].[revenue] › subscriber_id → subscriber_id › attribute_type",
      before: undefined,
      after: { property: "attribute_type", value: "bk" },
    }));
  });

  it("keeps type information supplied by DeepDiff", () => {
    const entries = presentDeepDiff({
      type_changes: {
        "root['properties'][0]['value']": {
          old_type: "int",
          new_type: "str",
          old_value: 30,
          new_value: "30",
        },
      },
    }, {
      properties: [{ property: "retention_days", value: 30 }],
    }, {
      properties: [{ property: "retention_days", value: "30" }],
    });

    expect(entries[0]).toEqual(expect.objectContaining({
      before: 30,
      after: "30",
      beforeType: "int",
      afterType: "str",
    }));
  });

  it("groups attribute leaf changes under one column without losing entries", () => {
    const entries = presentDeepDiff({
      values_changed: {
        "root['attributes'][0]['dataType']['type']": { old_value: "int", new_value: "long" },
        "root['attributes'][0]['dataType']['nullable']": { old_value: true, new_value: false },
      },
    }, {
      attributes: [{ name: "customer_id", dataType: { type: "int", nullable: true } }],
    }, {
      attributes: [{ name: "customer_id", dataType: { type: "long", nullable: false } }],
    });

    const groups = groupAttributeChanges(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("customer_id");
    expect(groups[0].changes).toHaveLength(entries.length);
    expect(groups[0].changes.map((entry) => entry.displayPath)).toEqual([
      "customer_id › dataType › type",
      "customer_id › dataType › nullable",
    ]);
    expect(groups[0].operation).toBe("changed");
  });

  it("keeps multiple external sources and their object and mapping changes separate", () => {
    const before = {
      sources: [
        {
          sourceLocation: "physical_a",
          mapping: [
            { sourceName: "root_subscriber_id", targetName: "subscriber_id", sourceDataType: { type: "int" } },
            { sourceName: "LegacyCode", targetName: "LegacyCode" },
          ],
        },
        {
          sourceAlias: "history",
          sourceLocation: "physical_b",
          properties: [{ property: "extract_mode", value: "full" }],
          mapping: [],
        },
      ],
    };
    const after = {
      sources: [
        {
          sourceLocation: "physical_a_v2",
          mapping: [
            { sourceName: "root_subscriber_id", targetName: "subscriber_id", sourceDataType: { type: "long" } },
            { sourceName: "CreatedAt", targetName: "CreatedAt" },
          ],
        },
        {
          sourceAlias: "history",
          sourceLocation: "physical_b",
          properties: [{ property: "extract_mode", value: "delta" }],
          mapping: [],
        },
      ],
    };
    const entries = presentDeepDiff({
      values_changed: {
        "root['sources'][0]['sourceLocation']": { old_value: "physical_a", new_value: "physical_a_v2" },
        "root['sources'][0]['mapping'][0]['sourceDataType']['type']": { old_value: "int", new_value: "long" },
        "root['sources'][1]['properties'][0]['value']": { old_value: "full", new_value: "delta" },
      },
      iterable_item_added: {
        "root['sources'][0]['mapping'][1]": after.sources[0].mapping[1],
      },
      iterable_item_removed: {
        "root['sources'][0]['mapping'][1]": before.sources[0].mapping[1],
      },
    }, before, after);

    const sources = groupExternalSourceChanges(entries);
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.label)).toEqual(["physical_a_v2", "history"]);
    expect(sources[0].objectChanges).toHaveLength(1);
    expect(sources[0].columns).toHaveLength(3);
    expect(sources[0].columns[0].label).toBe("root_subscriber_id → subscriber_id");
    expect(sources[0].columns.map((column) => column.label)).toEqual([
      "root_subscriber_id → subscriber_id",
      "CreatedAt → CreatedAt",
      "LegacyCode → LegacyCode",
    ]);
    expect(sources[0].columns.map((column) => column.operation)).toEqual([
      "changed",
      "added",
      "removed",
    ]);
    expect(sources[1].objectChanges).toHaveLength(1);
    expect(sources.reduce((count, source) => count + source.changes.length, 0)).toBe(entries.length);
  });

  it("marks a column changed when its details contain mixed generator operations", () => {
    const entries = presentDeepDiff({
      values_changed: {
        "root['sources'][0]['mapping'][0]['sourceDataType']['type']": {
          old_value: "int",
          new_value: "long",
        },
      },
      iterable_item_added: {
        "root['sources'][0]['mapping'][0]['properties'][0]": {
          property: "attribute_type",
          value: "bk",
        },
      },
    }, before, after);

    const source = groupExternalSourceChanges(entries)[0];
    expect(source.columns).toHaveLength(1);
    expect(source.columns[0].operation).toBe("changed");
    expect(source.columns[0].changes).toHaveLength(2);
  });

  it("marks a mapping changed when only a nested field is removed", () => {
    const entries = presentDeepDiff({
      dictionary_item_removed: [
        "root['sources'][0]['mapping'][0]['sourceDataType']['scale']",
      ],
    }, {
      sources: [{
        sourceLocation: "sales.retail",
        mapping: [{
          sourceName: "retail_charge",
          targetName: "retail_charge",
          sourceDataType: { type: "decimal", precision: 12, scale: 2 },
        }],
      }],
    }, {
      sources: [{
        sourceLocation: "sales.retail",
        mapping: [{
          sourceName: "retail_charge",
          targetName: "retail_charge",
          sourceDataType: { type: "decimal", precision: 12 },
        }],
      }],
    });

    const source = groupExternalSourceChanges(entries)[0];
    expect(source.columns).toHaveLength(1);
    expect(source.columns[0].operation).toBe("changed");
    expect(source.columns[0].changes[0].displayPath).toContain("sourceDataType › scale");
  });

  it("extracts all added mapping fields, named nested properties and datatype parameters without increasing counts", () => {
    const mapping = { sourceName: "amount", targetName: "total", sourceDataType: { type: "decimal", precision: 18, scale: 4, nullable: false },
      properties: [{ property: "format", value: { unit: "EUR", options: { round: true } } }] };
    const before = { sources: [{ sourceLocation: "sales", mapping: [] }] };
    const after = { sources: [{ sourceLocation: "sales", mapping: [mapping] }] };
    const entries = presentDeepDiff({ iterable_item_added: { "root['sources'][0]['mapping'][0]": mapping } }, before, after);
    const [source] = groupExternalSourceChanges(entries);
    expect(source.operation).toBe("changed");
    expect(source.changes).toHaveLength(1);
    expect(source.columns[0].changes).toHaveLength(1);
    expect(source.columns[0].operation).toBe("added");
    expect(source.columns[0].fields.map((field) => field.after)).toEqual(["amount", "total", "decimal", 18, 4, false, "EUR", true]);
    expect(source.columns[0].fields.map((field) => field.displayPath)).toContain("sales › amount → total › format › options › round");
    expect(source.columns[0].fields.every((field) => typeof field.after !== "object")).toBe(true);
  });

  it("keeps an existing mapping and attribute changed when only a property is added", () => {
    const before = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "id", targetName: "id", properties: [] }] }], attributes: [{ name: "id", properties: [] }] };
    const property = { property: "attribute_type", value: "bk" };
    const after = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "id", targetName: "id", properties: [property] }] }], attributes: [{ name: "id", properties: [property] }] };
    const entries = presentDeepDiff({ iterable_item_added: {
      "root['sources'][0]['mapping'][0]['properties'][0]": property,
      "root['attributes'][0]['properties'][0]": property,
    } }, before, after);
    const [source] = groupExternalSourceChanges(entries.filter((entry) => entry.group === "mappings"));
    expect(source.columns[0].operation).toBe("changed");
    expect(source.columns[0].fields[0]).toMatchObject({ after: "bk", displayPath: "sales › id → id › attribute_type" });
    expect(groupAttributeChanges(entries.filter((entry) => entry.group === "attributes"))[0].operation).toBe("changed");
  });

  it.each(["added", "removed"] as const)("extracts mappings from an entire %s source without duplicating generator changes", (operation) => {
    const source = { sourceLocation: "archive", mapping: [{ sourceName: "id", targetName: "id" }, { sourceName: "code", targetName: "code" }] };
    const before = { sources: operation === "removed" ? [source] : [] };
    const after = { sources: operation === "added" ? [source] : [] };
    const entries = presentDeepDiff({ [`iterable_item_${operation}`]: { "root['sources'][0]": source } }, before, after);
    const [group] = groupExternalSourceChanges(entries);
    expect(group.operation).toBe(operation);
    expect(group.changes).toHaveLength(1);
    expect(group.objectChanges.map((field) => field.displayPath)).toEqual(["archive › sourceLocation"]);
    expect(group.columns).toHaveLength(2);
    expect(group.columns.every((column) => column.operation === operation)).toBe(true);
    expect(group.columns.flatMap((column) => column.fields).every((field) => typeof field.before !== "object" && typeof field.after !== "object")).toBe(true);
  });

  it("extracts a replaced mapping list and only the changed fields of its existing mappings", () => {
    const before = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "amount", targetName: "amount", sourceDataType: { type: "decimal", precision: 12, scale: 2 } }] }] };
    const after = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "amount", targetName: "total", sourceDataType: { type: "decimal", precision: 18, scale: 4 } }] }] };
    const entries = presentDeepDiff({ values_changed: { "root['sources'][0]['mapping']": { old_value: before.sources[0].mapping, new_value: after.sources[0].mapping } } }, before, after);
    const [source] = groupExternalSourceChanges(entries);
    const [mapping] = source.columns;
    expect(mapping.operation).toBe("changed");
    expect(mapping.fields.map((field) => field.displayPath.split(" › ").at(-1))).toEqual(["targetName", "precision", "scale"]);
    expect(source.changes).toHaveLength(1);
  });

  it("keeps removed nested fields under the same mapping after a target rename", () => {
    const before = { sources: [{ sourceLocation: "old", mapping: [{ sourceName: "id", targetName: "old_id", sourceDataType: { type: "int", nullable: true } }] }] };
    const after = { sources: [{ sourceLocation: "new", mapping: [{ sourceName: "id", targetName: "new_id", sourceDataType: { type: "int" } }] }] };
    const entries = presentDeepDiff({ values_changed: {
      "root['sources'][0]['sourceLocation']": { old_value: "old", new_value: "new" },
      "root['sources'][0]['mapping'][0]['targetName']": { old_value: "old_id", new_value: "new_id" },
    }, dictionary_item_removed: ["root['sources'][0]['mapping'][0]['sourceDataType']['nullable']"] }, before, after);
    const groups = groupExternalSourceChanges(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toHaveLength(1);
    expect(groups[0].columns[0].label).toBe("id → new_id");
    expect(groups[0].columns[0].changes).toHaveLength(2);
  });

  it("keeps explicit type changes even when serialized values are equal", () => {
    const [entry] = presentDeepDiff({ type_changes: { "root['description']": { old_value: 1, new_value: 1, old_type: "int", new_type: "float" } } }, {}, {});
    expect(readableChangeFields(entry)).toHaveLength(1);
    expect(readableChangeFields(entry)[0].afterType).toBe("float");
  });

  it("determines mapping additions and removals inside whole list replacements from snapshots", () => {
    const first = { sourceName: "id", targetName: "id" };
    const second = { sourceName: "code", targetName: "code" };
    for (const removed of [false, true]) {
      const before = { sources: [{ sourceLocation: "sales", mapping: removed ? [first, second] : [first] }] };
      const after = { sources: [{ sourceLocation: "sales", mapping: removed ? [first] : [first, second] }] };
      const entries = presentDeepDiff({ values_changed: { "root['sources'][0]['mapping']": { old_value: before.sources[0].mapping, new_value: after.sources[0].mapping } } }, before, after);
      const [source] = groupExternalSourceChanges(entries);
      expect(source.changes).toHaveLength(1);
      expect(source.columns).toHaveLength(1);
      expect(source.columns[0].operation).toBe(removed ? "removed" : "added");
    }
  });

  it("preserves both sides of scalar to structured mapping property changes without object values", () => {
    const before = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "id", targetName: "id", properties: [{ property: "format", value: "EUR" }] }] }] };
    const after = { sources: [{ sourceLocation: "sales", mapping: [{ sourceName: "id", targetName: "id", properties: [{ property: "format", value: { unit: "EUR", round: false } }] }] }] };
    const entries = presentDeepDiff({ type_changes: { "root['sources'][0]['mapping'][0]['properties'][0]['value']": { old_value: "EUR", new_value: { unit: "EUR", round: false }, old_type: "str", new_type: "dict" } } }, before, after);
    const fields = groupExternalSourceChanges(entries)[0].columns[0].fields;
    expect(fields.map((field) => [field.before, field.after])).toEqual([["EUR", undefined], [undefined, "EUR"], [undefined, false]]);
    expect(fields.every((field) => typeof field.before !== "object" && typeof field.after !== "object")).toBe(true);
  });
});
