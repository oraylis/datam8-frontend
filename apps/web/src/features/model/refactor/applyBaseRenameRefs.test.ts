import { describe, expect, it } from "vitest";
import {
  applyBaseNameRenamesToBaseEntities,
  applyBaseNameRenamesToFolderEntities,
  applyBaseNameRenamesToModelEntities,
  diffDataModuleRenames,
} from "./applyBaseRenameRefs";

describe("base rename references", () => {
  it("updates model references for attribute types, data types, and data sources", () => {
    const entity: any = {
      relPath: "model/020_gold/customer.json",
      content: {
        attributes: [{ attributeType: "oldAttribute", dataType: { type: "oldType" } }],
        sources: [{ dataSource: "oldSource", mapping: [{ sourceDataType: { type: "oldType" } }] }],
        relationships: [{ dataSource: "oldSource" }],
      },
    };

    expect(applyBaseNameRenamesToModelEntities([entity], "attributeTypes", [{ oldName: "oldAttribute", newName: "newAttribute" }]).updatedEntities[0].content.attributes?.[0].attributeType).toBe("newAttribute");
    expect(applyBaseNameRenamesToModelEntities([entity], "dataTypes", [{ oldName: "oldType", newName: "newType" }]).changeCount).toBe(2);
    expect(applyBaseNameRenamesToModelEntities([entity], "dataSources", [{ oldName: "oldSource", newName: "newSource" }]).changeCount).toBe(2);
  });

  it("updates data source type and folder product/module references", () => {
    const base: any = { relPath: "shared/base/DataSources.json", content: { type: "dataSources", dataSources: [{ name: "crm", type: "oldType" }] } };
    const baseResult = applyBaseNameRenamesToBaseEntities([base], "dataSourceTypes", [{ oldName: "oldType", newName: "newType" }]);
    expect(baseResult.updatedEntities[0]?.content.dataSources?.[0]?.type).toBe("newType");

    const modules = diffDataModuleRenames(
      [{ name: "sales", dataModules: [{ name: "orders" }] }],
      [{ name: "commercial", dataModules: [{ name: "purchases" }] }],
    );
    const folder: any = { folderPath: "020_gold/sales", content: { dataProduct: "sales", dataModule: "orders" } };
    const result = applyBaseNameRenamesToFolderEntities(
      [folder],
      "dataProducts",
      [{ oldName: "sales", newName: "commercial" }],
      modules,
    );
    expect(result.updatedEntities[0].content).toMatchObject({ dataProduct: "commercial", dataModule: "purchases" });
  });
});
