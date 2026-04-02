import { describe, expect, it } from "vitest";
import { computeBaseSaveCountFor } from "./useSaveCoordinator";
import type { BaseEntity } from "../model-types";

function createBaseEntity(overrides: Partial<BaseEntity>): BaseEntity {
  return {
    name: "Base",
    relPath: "Base/Base.json",
    content: {},
    ...overrides,
  };
}

describe("computeBaseSaveCountFor", () => {
  it("counts a single save for properties when PropertyValues is separate", () => {
    const propertiesEntry = createBaseEntity({
      name: "Properties",
      relPath: "Base/Properties.json",
      content: { properties: [{ name: "Priority" }] },
    });
    const propertyValuesEntry = createBaseEntity({
      name: "PropertyValues",
      relPath: "Base/PropertyValues.json",
      content: { propertyValues: [{ property: "Priority", name: "High" }] },
    });

    const total = computeBaseSaveCountFor({
      relPath: propertiesEntry.relPath,
      baseEntities: [propertiesEntry, propertyValuesEntry],
    });

    expect(total).toBe(1);
  });

  it("counts a single save for non-properties entries", () => {
    const dataTypesEntry = createBaseEntity({
      name: "DataTypes",
      relPath: "Base/DataTypes.json",
      content: { dataTypes: [{ name: "varchar" }] },
    });

    const total = computeBaseSaveCountFor({
      relPath: dataTypesEntry.relPath,
      baseEntities: [dataTypesEntry],
    });

    expect(total).toBe(1);
  });
});
