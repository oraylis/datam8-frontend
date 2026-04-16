import { describe, expect, it } from "vitest";
import { buildPropertyScopeTargetIndex, collectAvailableBaseScopeTargets } from "./propertyRefactorScopes";
import type { BaseEntity } from "../model-types";

describe("propertyRefactorScopes", () => {
  it("maps legacy properties scope to propertyValues target", () => {
    const index = buildPropertyScopeTargetIndex({
      properties: [
        {
          name: "jobs",
          scopes: [{ type: "properties" }, { type: "folder" }],
        },
      ],
    });

    expect(index.get("jobs")).toEqual(["propertyValues", "folder"]);
  });

  it("includes propertyValues as concrete base scope option", () => {
    const baseEntities: BaseEntity[] = [
      {
        name: "PropertyValues",
        relPath: "Base/PropertyValues.json",
        content: {
          propertyValues: [{ property: "jobs", name: "daily" }],
        },
      },
    ];

    expect(collectAvailableBaseScopeTargets(baseEntities)).toEqual(["propertyValues"]);
  });
});
