import { describe, expect, it } from "vitest";
import { applyPropertyRefactorToModelEntities } from "./applyPropertyRefactor";
import type { ModelEntity } from "../model-types";

const modelEntity = (overrides: Partial<ModelEntity>): ModelEntity => ({
  locator: "/model/a",
  name: "a",
  relPath: "Model/Raw/A/B/a.json",
  content: {},
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
    });

    expect(result.updatedEntities).toHaveLength(1);
    expect((result.updatedEntities[0].content as any).attributes).toEqual([
      { name: "Id", properties: [] },
      { name: "Name", properties: [{ property: "domain", value: "sales" }] },
    ]);
  });
});
