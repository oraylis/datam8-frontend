import { describe, expect, it } from "vitest";
import { computeBaseSaveCountFor } from "./useSaveCoordinator";
import type { BaseEntity } from "../model-types";

describe("computeBaseSaveCountFor", () => {
  it("counts a properties change once even when its values live in a separate Base file", () => {
    const properties: BaseEntity = {
      name: "Properties",
      relPath: "Base/Properties.json",
      content: { properties: [{ name: "Priority" }] },
    };
    const propertyValues: BaseEntity = {
      name: "PropertyValues",
      relPath: "Base/PropertyValues.json",
      content: { propertyValues: [{ property: "Priority", name: "High" }] },
    };

    expect(computeBaseSaveCountFor({ relPath: properties.relPath, baseEntities: [properties, propertyValues] })).toBe(1);
  });
});
