import { describe, expect, it } from "vitest";
import { buildTree, detectBaseType, resolveFolderInheritance } from "./model-utils";
import type { FolderEntity, ModelEntity } from "./model-types";
import type { PropertyAssignment } from "@datam8/types";

type TreeLikeNode = { label: string; path?: string; children?: TreeLikeNode[] };

function findFolder(nodes: TreeLikeNode[], path: string): TreeLikeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found: TreeLikeNode | null = findFolder(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

describe("model-utils folder tree and inheritance", () => {
  it("detects propertyValues from file name and type hint", () => {
    const fromFile = detectBaseType(
      {
        propertyValues: [{ property: "schedule", name: "daily" }],
      },
      "Base/PropertyValues.json",
    );
    const fromType = detectBaseType(
      {
        type: "propertyValues",
        propertyValues: [{ property: "schedule", name: "weekly" }],
      },
      "Base/Custom.json",
    );

    expect(fromFile.type).toBe("propertyValues");
    expect(fromType.type).toBe("propertyValues");
    expect(fromType.items).toHaveLength(1);
  });

  it("uses folder metadata names for tree labels at arbitrary depth", () => {
    const entities: ModelEntity[] = [
      {
        locator: "/Model/010-Stage/Sales/Orders/Customer",
        name: "Customer",
        relPath: "Model/010-Stage/Sales/Orders/Customer.json",
        content: {},
      },
    ];

    const folderEntities: FolderEntity[] = [
      {
        locator: "/folders/010-Stage",
        name: "Stage",
        relPath: "Model/010-Stage/.properties.json",
        folderPath: "010-Stage",
        content: { id: 1, name: "Stage Zone", properties: [] },
      },
      {
        locator: "/folders/010-Stage/Sales",
        name: "Sales",
        relPath: "Model/010-Stage/Sales/.properties.json",
        folderPath: "010-Stage/Sales",
        content: { id: 2, name: "Sales Domain", properties: [] },
      },
    ];

    const tree = buildTree(entities, folderEntities);
    const zoneFolder = findFolder(tree, "010-Stage");
    const domainFolder = findFolder(tree, "010-Stage/Sales");

    expect(zoneFolder?.label).toBe("Stage Zone");
    expect(domainFolder?.label).toBe("Sales Domain");
  });

  it("does not inject unrelated folder metadata into the model tree", () => {
    const entities: ModelEntity[] = [
      {
        locator: "/Model/040-Consumer/Sales/Dim/Customer",
        name: "Customer",
        relPath: "Model/040-Consumer/Sales/Dim/Customer.json",
        content: {},
      },
    ];

    const folderEntities: FolderEntity[] = [
      {
        locator: "/folders/040-Consumer/Sales/Dim",
        name: "Dim",
        relPath: "Model/040-Consumer/Sales/Dim/.properties.json",
        folderPath: "040-Consumer/Sales/Dim",
        content: { id: 1, name: "Dim", properties: [] },
      },
      {
        locator: "/folders/business_area",
        name: "business_area",
        relPath: "Model/business_area/.properties.json",
        folderPath: "business_area",
        content: { id: 2, name: "business_area", properties: [] },
      },
    ];

    const tree = buildTree(entities, folderEntities, ["040-Consumer"]);
    expect(findFolder(tree, "business_area")).toBeNull();
    expect(findFolder(tree, "040-Consumer/Sales/Dim")).not.toBeNull();
  });

  it("resolves inherited properties and effective data product/module from folder chain", () => {
    const folderEntities: FolderEntity[] = [
      {
        locator: "/folders/010-Stage",
        name: "Stage",
        relPath: "Model/010-Stage/.properties.json",
        folderPath: "010-Stage",
        content: {
          id: 1,
          name: "Stage",
          dataProduct: "Product A",
          dataModule: "Module A",
          properties: [
            { property: "owner", value: "team-a" },
            { property: "retention", value: "30d" },
          ],
        },
      },
      {
        locator: "/folders/010-Stage/Sales",
        name: "Sales",
        relPath: "Model/010-Stage/Sales/.properties.json",
        folderPath: "010-Stage/Sales",
        content: {
          id: 2,
          name: "Sales",
          dataProduct: "Product B",
          properties: [
            { property: "retention", value: "90d" },
            { property: "domain", value: "sales" },
          ],
        },
      },
      {
        locator: "/folders/010-Stage/Sales/Orders",
        name: "Orders",
        relPath: "Model/010-Stage/Sales/Orders/.properties.json",
        folderPath: "010-Stage/Sales/Orders",
        content: {
          id: 3,
          name: "Orders",
          properties: [{ property: "domain", value: "orders" }],
        },
      },
    ];

    const resolved = resolveFolderInheritance({
      entityRelPath: "Model/010-Stage/Sales/Orders/Customer.json",
      folderEntities,
    });

    const propsByKey = new Map(
      resolved.inheritedProps.map((entry: PropertyAssignment) => [entry.property, entry.value]),
    );

    expect(propsByKey.get("owner")).toBe("team-a");
    expect(propsByKey.get("retention")).toBe("90d");
    expect(propsByKey.get("domain")).toBe("orders");
    expect(resolved.effectiveDataProduct).toBe("Product B");
    expect(resolved.effectiveDataModule).toBe("Module A");
  });

  it("resolves inheritance for folders from parent chain only", () => {
    const folderEntities: FolderEntity[] = [
      {
        locator: "/folders/010-Stage",
        name: "Stage",
        relPath: "Model/010-Stage/.properties.json",
        folderPath: "010-Stage",
        content: {
          id: 1,
          name: "Stage",
          dataProduct: "Product A",
          dataModule: "Module A",
          properties: [
            { property: "owner", value: "team-a" },
            { property: "retention", value: "30d" },
          ],
        },
      },
      {
        locator: "/folders/010-Stage/Sales",
        name: "Sales",
        relPath: "Model/010-Stage/Sales/.properties.json",
        folderPath: "010-Stage/Sales",
        content: {
          id: 2,
          name: "Sales",
          dataProduct: "Product B",
          properties: [
            { property: "retention", value: "90d" },
            { property: "domain", value: "sales" },
          ],
        },
      },
      {
        locator: "/folders/010-Stage/Sales/Orders",
        name: "Orders",
        relPath: "Model/010-Stage/Sales/Orders/.properties.json",
        folderPath: "010-Stage/Sales/Orders",
        content: {
          id: 3,
          name: "Orders",
          properties: [{ property: "domain", value: "orders" }],
        },
      },
    ];

    const resolved = resolveFolderInheritance({
      folderPath: "010-Stage/Sales/Orders",
      folderEntities,
      includeCurrentFolder: false,
    });

    const propsByKey = new Map(
      resolved.inheritedProps.map((entry: PropertyAssignment) => [entry.property, entry.value]),
    );

    expect(resolved.folderChain).toEqual(["010-Stage", "010-Stage/Sales"]);
    expect(propsByKey.get("owner")).toBe("team-a");
    expect(propsByKey.get("retention")).toBe("90d");
    expect(propsByKey.get("domain")).toBe("sales");
    expect(resolved.effectiveDataProduct).toBe("Product B");
    expect(resolved.effectiveDataModule).toBe("Module A");
  });
});
