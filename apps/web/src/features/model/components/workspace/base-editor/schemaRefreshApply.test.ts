import { describe, expect, it } from "vitest";
import { applyColumnSchemaChangesToEntityContent } from "./schemaRefreshApply";

describe("applyColumnSchemaChangesToEntityContent", () => {
  it("adds new source columns to attributes and source mapping", () => {
    const content = {
      attributes: [
        {
          ordinalNumber: 1,
          name: "existing_col",
          attributeType: "Regular",
          dataType: { type: "string", nullable: true },
        },
      ],
      sources: [
        {
          dataSource: "dbr-mobilfunk-ingest",
          sourceLocation: "ingest_mobilfunk_dev.mavenir_cgf_raw.ic_cdr",
          mapping: [
            {
              sourceName: "existing_col",
              targetName: "existing_col",
              sourceDataType: { type: "string", nullable: true },
            },
          ],
        },
      ],
    };

    applyColumnSchemaChangesToEntityContent(
      content,
      0,
      [
        {
          changeType: "NEW_COLUMN",
          columnName: "new_col",
          sourceAfter: {
            name: "new_col",
            dataType: "decimal",
            numericPrecision: 18,
            numericScale: 4,
            isNullable: false,
            properties: [{ property: "classification", value: "technical" }],
          },
        },
      ],
      new Set(["new_col::NEW_COLUMN"]),
    );

    expect(content.attributes).toContainEqual(expect.objectContaining({
      ordinalNumber: 2,
      name: "new_col",
      dataType: { type: "decimal", nullable: false },
    }));
    expect(content.sources[0].mapping).toContainEqual({
      sourceName: "new_col",
      targetName: "new_col",
      sourceDataType: {
        type: "decimal",
        nullable: false,
        precision: 18,
        scale: 4,
      },
      properties: [{ property: "classification", value: "technical" }],
    });
  });

  it("adds a missing mapping when the target attribute already exists", () => {
    const content = {
      attributes: [
        {
          ordinalNumber: 1,
          name: "new_col",
          attributeType: "Regular",
          dataType: { type: "string", nullable: true },
        },
      ],
      sources: [
        {
          dataSource: "dbr-mobilfunk-ingest",
          sourceLocation: "ingest_mobilfunk_dev.mavenir_cgf_raw.ic_cdr",
          mapping: [],
        },
      ],
    };

    applyColumnSchemaChangesToEntityContent(
      content,
      0,
      [
        {
          changeType: "NEW_COLUMN",
          columnName: "new_col",
          sourceAfter: { name: "new_col", dataType: "string", isNullable: true },
        },
      ],
      new Set(["new_col::NEW_COLUMN"]),
    );

    expect(content.attributes).toHaveLength(1);
    expect(content.sources[0].mapping).toEqual([
      {
        sourceName: "new_col",
        targetName: "new_col",
        sourceDataType: { type: "string", nullable: true },
      },
    ]);
  });

  it("inserts new source columns at their source ordinal position", () => {
    const content = {
      attributes: [
        { ordinalNumber: 1, name: "first_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
        { ordinalNumber: 2, name: "third_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
      ],
      sources: [
        {
          mapping: [
            { sourceName: "first_col", targetName: "first_col", sourceDataType: { type: "string", nullable: true } },
            { sourceName: "third_col", targetName: "third_col", sourceDataType: { type: "string", nullable: true } },
          ],
        },
      ],
    };

    applyColumnSchemaChangesToEntityContent(
      content,
      0,
      [
        {
          changeType: "NEW_COLUMN",
          columnName: "second_col",
          sourceAfter: {
            name: "second_col",
            ordinal: 2,
            dataType: "int",
            isNullable: false,
          },
        },
      ],
      new Set(["second_col::NEW_COLUMN"]),
    );

    expect(content.sources[0].mapping.map((mapping: any) => mapping.sourceName)).toEqual([
      "first_col",
      "second_col",
      "third_col",
    ]);
    expect(content.attributes.map((attribute: any) => attribute.name)).toEqual([
      "first_col",
      "second_col",
      "third_col",
    ]);
    expect(content.attributes.map((attribute: any) => attribute.ordinalNumber)).toEqual([1, 2, 3]);
  });

  it("keeps source order when multiple new columns are applied out of diff order", () => {
    const content = {
      attributes: [
        { ordinalNumber: 1, name: "first_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
        { ordinalNumber: 2, name: "fourth_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
      ],
      sources: [
        {
          mapping: [
            { sourceName: "first_col", targetName: "first_col", sourceDataType: { type: "string", nullable: true } },
            { sourceName: "fourth_col", targetName: "fourth_col", sourceDataType: { type: "string", nullable: true } },
          ],
        },
      ],
    };

    applyColumnSchemaChangesToEntityContent(
      content,
      0,
      [
        { changeType: "NEW_COLUMN", columnName: "third_col", sourceAfter: { ordinal: 3, dataType: "string", isNullable: true } },
        { changeType: "NEW_COLUMN", columnName: "second_col", sourceAfter: { ordinal: 2, dataType: "string", isNullable: true } },
      ],
      new Set(["second_col::NEW_COLUMN", "third_col::NEW_COLUMN"]),
    );

    expect(content.sources[0].mapping.map((mapping: any) => mapping.sourceName)).toEqual([
      "first_col",
      "second_col",
      "third_col",
      "fourth_col",
    ]);
    expect(content.attributes.map((attribute: any) => attribute.name)).toEqual([
      "first_col",
      "second_col",
      "third_col",
      "fourth_col",
    ]);
  });

  it("removes deleted source columns from attributes and source mapping", () => {
    const content = {
      attributes: [
        { ordinalNumber: 1, name: "keep_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
        { ordinalNumber: 2, name: "gone_col", attributeType: "Regular", dataType: { type: "string", nullable: true } },
      ],
      sources: [
        {
          mapping: [
            { sourceName: "keep_col", targetName: "keep_col", sourceDataType: { type: "string", nullable: true } },
            { sourceName: "gone_col", targetName: "gone_col", sourceDataType: { type: "string", nullable: true } },
          ],
        },
      ],
    };

    applyColumnSchemaChangesToEntityContent(
      content,
      0,
      [
        {
          changeType: "REMOVED_COLUMN",
          columnName: "gone_col",
          entityAttributeName: "gone_col",
        },
      ],
      new Set(["gone_col::REMOVED_COLUMN"]),
    );

    expect(content.attributes).toEqual([
      expect.objectContaining({ ordinalNumber: 1, name: "keep_col" }),
    ]);
    expect(content.sources[0].mapping).toEqual([
      expect.objectContaining({ sourceName: "keep_col", targetName: "keep_col" }),
    ]);
  });
});
