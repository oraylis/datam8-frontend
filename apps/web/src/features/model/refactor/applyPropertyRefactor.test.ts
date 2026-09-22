import { describe, expect, it } from "vitest";
import {
  applyPropertyRefactorToBaseEntities,
  applyPropertyRefactorToFolderEntities,
  applyPropertyRefactorToModelEntities,
} from "./applyPropertyRefactor";
import type { BaseEntity, FolderEntity, ModelEntity } from "../model-types";

const modelEntity = (overrides: Partial<ModelEntity>): ModelEntity => ({
  locator: "/model/a",
  name: "a",
  relPath: "Model/Raw/A/B/a.json",
  content: {},
  ...overrides,
});

const folderEntity = (overrides: Partial<FolderEntity>): FolderEntity => ({
  locator: "/folders/Raw/Sales",
  name: "Sales",
  relPath: "Model/Raw/Sales/.properties.json",
  folderPath: "Raw/Sales",
  content: { id: 1, name: "Sales", properties: [] },
  ...overrides,
});

const baseEntity = (overrides: Partial<BaseEntity>): BaseEntity => ({
  name: "Zones",
  relPath: "Base/Zones.json",
  content: { zones: [] },
  ...overrides,
});

describe("applyPropertyRefactorToModelEntities", () => {
  it("renames property keys and values in model entity property rows", () => {
    const entities = [
      modelEntity({
        content: {
          properties: [{ property: "domain", value: "sales" }],
        },
      }),
    ];

    const result = applyPropertyRefactorToModelEntities(entities, {
      propertyRenames: [{ oldName: "domain", newName: "businessDomain" }],
      valueRenames: [{ property: "businessDomain", oldValue: "sales", newValue: "finance" }],
      deletedProperties: [],
      deletedValues: [],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([
      { property: "businessDomain", value: "finance" },
    ]);
  });

  it("removes deleted property assignments recursively", () => {
    const entities = [
      modelEntity({
        content: {
          attributes: [
            { name: "Id", properties: [{ property: "sensitivity", value: "high" }] },
            { name: "Name", properties: [{ property: "domain", value: "sales" }] },
          ],
        },
      }),
    ];

    const result = applyPropertyRefactorToModelEntities(entities, {
      propertyRenames: [],
      valueRenames: [],
      deletedProperties: ["sensitivity"],
      deletedValues: [],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).attributes).toEqual([
      { name: "Id", properties: [] },
      { name: "Name", properties: [{ property: "domain", value: "sales" }] },
    ]);
  });

  it("moves property assignments to another property when value move rules are present", () => {
    const entities = [
      modelEntity({
        content: {
          properties: [{ property: "domain", value: "sales" }],
        },
      }),
    ];

    const result = applyPropertyRefactorToModelEntities(entities, {
      propertyRenames: [],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [],
      valueMoves: [
        {
          oldProperty: "domain",
          oldValue: "sales",
          newProperty: "businessDomain",
          newValue: "sales",
        },
      ],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([
      { property: "businessDomain", value: "sales" },
    ]);
  });

  it("removes deleted property value assignments recursively", () => {
    const entities = [
      modelEntity({
        content: {
          properties: [{ property: "domain", value: "sales" }],
          attributes: [{ name: "Id", properties: [{ property: "domain", value: "sales" }] }],
          sources: [
            {
              dataSource: "CRM",
              properties: [{ property: "domain", value: "sales" }],
              mapping: [{ target: "Id", properties: [{ property: "domain", value: "sales" }] }],
            },
          ],
          transformations: [{ step: 1, properties: [{ property: "domain", value: "sales" }] }],
        },
      }),
    ];

    const result = applyPropertyRefactorToModelEntities(entities, {
      propertyRenames: [],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [{ property: "domain", value: "sales" }],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([]);
    expect((result.updatedEntities[0].content as any).attributes[0].properties).toEqual([]);
    expect((result.updatedEntities[0].content as any).sources[0].properties).toEqual([]);
    expect((result.updatedEntities[0].content as any).sources[0].mapping[0].properties).toEqual([]);
    expect((result.updatedEntities[0].content as any).transformations[0].properties).toEqual([]);
  });

  it("does not mutate unrelated objects that only have a property key", () => {
    const entities = [
      modelEntity({
        content: {
          parameters: [{ property: "domain", value: "sales" }],
          properties: [{ property: "domain", value: "sales" }],
        },
      }),
    ];

    const result = applyPropertyRefactorToModelEntities(entities, {
      propertyRenames: [{ oldName: "domain", newName: "businessDomain" }],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([
      { property: "businessDomain", value: "sales" },
    ]);
    expect((result.updatedEntities[0].content as any).parameters).toEqual([
      { property: "domain", value: "sales" },
    ]);
  });
});

describe("applyPropertyRefactorToFolderEntities", () => {
  it("updates folder property assignments", () => {
    const folders = [
      folderEntity({
        content: { id: 1, name: "Sales", properties: [{ property: "domain", value: "sales" }] },
      }),
    ];

    const result = applyPropertyRefactorToFolderEntities(folders, {
      propertyRenames: [{ oldName: "domain", newName: "businessDomain" }],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([
      { property: "businessDomain", value: "sales" },
    ]);
  });

  it("removes deleted property value assignments from folder metadata", () => {
    const folders = [
      folderEntity({
        content: { id: 1, name: "Sales", properties: [{ property: "domain", value: "sales" }] },
      }),
    ];

    const result = applyPropertyRefactorToFolderEntities(folders, {
      propertyRenames: [],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [{ property: "domain", value: "sales" }],
      valueMoves: [],
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).properties).toEqual([]);
  });
});

describe("applyPropertyRefactorToBaseEntities", () => {
  it("updates only selected base scope targets", () => {
    const bases = [
      baseEntity({
        name: "Zones",
        relPath: "Base/Zones.json",
        content: {
          zones: [{ name: "Raw", targetName: "raw", displayName: "Raw", properties: [{ property: "target", value: "legacy" }] }],
        },
      }),
      baseEntity({
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources: [{ name: "CRM", type: "Sql", properties: [{ property: "target", value: "legacy" }], extendedProperties: {} }],
        },
      }),
    ];

    const result = applyPropertyRefactorToBaseEntities(
      bases,
      {
        propertyRenames: [{ oldName: "target", newName: "destination" }],
        valueRenames: [],
        deletedProperties: [],
        deletedValues: [],
        valueMoves: [],
      },
      ["zone"],
    );

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).zones[0].properties).toEqual([
      { property: "destination", value: "legacy" },
    ]);
  });

  it("updates propertyValues rows when propertyValues scope target is selected", () => {
    const bases = [
      baseEntity({
        name: "PropertyValues",
        relPath: "Base/PropertyValues.json",
        content: {
          propertyValues: [
            { property: "jobs", name: "sales_daily" },
            { property: "jobs", name: "daily" },
            { property: "schedules", name: "daily" },
            {
              property: "jobs",
              name: "weekly",
              properties: [{ property: "schedules", value: "daily" }],
            },
          ],
        },
      }),
    ];

    const result = applyPropertyRefactorToBaseEntities(
      bases,
      {
        propertyRenames: [],
        valueRenames: [{ property: "jobs", oldValue: "sales_daily", newValue: "daily" }],
        deletedProperties: [],
        deletedValues: [],
        valueMoves: [],
      },
      ["propertyValues"],
    );

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).propertyValues).toEqual([
      { property: "jobs", name: "daily" },
      { property: "schedules", name: "daily" },
      {
        property: "jobs",
        name: "weekly",
        properties: [{ property: "schedules", value: "daily" }],
      },
    ]);
  });

  it("renames properties used inside propertyValues.properties assignments", () => {
    const bases = [
      baseEntity({
        name: "PropertyValues",
        relPath: "Base/PropertyValues.json",
        content: {
          propertyValues: [
            {
              property: "jobs",
              name: "daily",
              properties: [{ property: "schedules", value: "daily" }],
            },
          ],
        },
      }),
    ];

    const result = applyPropertyRefactorToBaseEntities(
      bases,
      {
        propertyRenames: [{ oldName: "schedules", newName: "schedules1" }],
        valueRenames: [],
        deletedProperties: [],
        deletedValues: [],
        valueMoves: [],
      },
      ["propertyValues"],
    );

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).propertyValues).toEqual([
      {
        property: "jobs",
        name: "daily",
        properties: [{ property: "schedules1", value: "daily" }],
      },
    ]);
  });

  it("removes deleted property value rows and base-list assignments", () => {
    const bases = [
      baseEntity({
        name: "PropertyValues",
        relPath: "Base/PropertyValues.json",
        content: {
          propertyValues: [
            { property: "domain", name: "sales" },
            { property: "domain", name: "finance" },
          ],
        },
      }),
      baseEntity({
        name: "DataSources",
        relPath: "Base/DataSources.json",
        content: {
          dataSources: [
            { name: "CRM", type: "Sql", properties: [{ property: "domain", value: "sales" }], extendedProperties: {} },
          ],
        },
      }),
    ];

    const result = applyPropertyRefactorToBaseEntities(
      bases,
      {
        propertyRenames: [],
        valueRenames: [],
        deletedProperties: [],
        deletedValues: [{ property: "domain", value: "sales" }],
        valueMoves: [],
      },
      ["propertyValues", "dataSource"],
    );

    expect(result.updatedEntities).toHaveLength(2);
    expect((result.updatedEntities[0].content as any).propertyValues).toEqual([
      { property: "domain", name: "finance" },
    ]);
    expect((result.updatedEntities[1].content as any).dataSources[0].properties).toEqual([]);
  });
});
