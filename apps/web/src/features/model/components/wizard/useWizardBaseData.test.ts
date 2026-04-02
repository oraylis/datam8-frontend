import { describe, expect, it } from "vitest";
import type { BaseEntity } from "../../model-types";
import { buildWizardPropertyOptions, resolveWizardDataSources } from "./useWizardBaseData";

function baseEntry(overrides: Partial<BaseEntity>): BaseEntity {
  return {
    name: "Base",
    relPath: "Base/Base.json",
    content: {},
    ...overrides,
  };
}

describe("buildWizardPropertyOptions", () => {
  it("merges values from property-values sidecar and inline values", () => {
    const properties = baseEntry({
      name: "Properties",
      relPath: "Base/Properties.json",
      content: {
        properties: [{ name: "Priority" }],
        propertyValues: [{ property: "Priority", name: "Low" }],
      },
    });
    const propertyValues = baseEntry({
      name: "PropertyValues",
      relPath: "Base/PropertyValues.json",
      content: {
        propertyValues: [{ property: "Priority", name: "High" }],
      },
    });

    const result = buildWizardPropertyOptions([properties, propertyValues]);

    expect(result).toEqual([{ name: "Priority", values: ["High", "Low"] }]);
  });
});

describe("resolveWizardDataSources", () => {
  it("resolves connector id from DataSourceType pluginId", () => {
    const result = resolveWizardDataSources({
      dataSources: [{ name: "DWH", type: "SqlServer", extendedProperties: {} }],
      dataSourceTypes: [
        {
          name: "SqlServer",
          pluginId: "sqlserver",
        },
      ],
    });

    expect(result[0]?.connectorId).toBe("sqlserver");
    expect(result[0]?.dataSourceType?.name).toBe("SqlServer");
  });
});
