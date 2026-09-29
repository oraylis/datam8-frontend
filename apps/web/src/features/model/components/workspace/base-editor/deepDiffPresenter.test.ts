import { describe, expect, it } from "vitest";
import { groupAttributeChanges, groupExternalSourceChanges, presentDeepDiff } from "./deepDiffPresenter";

describe("presentDeepDiff", () => {
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
});
