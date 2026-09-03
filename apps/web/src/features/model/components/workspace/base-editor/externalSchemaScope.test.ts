import { describe, expect, it } from "vitest";
import {
  externalSchemaTriState,
  groupExternalSchemaUsages,
  isSchemaChangeSuggested,
  isUsageInitiallySelected,
  isUsageInExternalSchemaScope,
  keepRelationshipMappingsForColumns,
  needsExternalSchemaSourceContext,
} from "./externalSchemaScope";

const usage = (dataSource: string, entityRelPath: string, sourceIndex = 0) => ({ dataSource, entityRelPath, sourceIndex });

describe("external schema scopes", () => {
  it("includes every source for the global scope", () => {
    expect(isUsageInExternalSchemaScope({ kind: "all" }, usage("CRM", "Model/A.json"))).toBe(true);
  });

  it("filters refresh and browse scopes to their data source", () => {
    expect(isUsageInExternalSchemaScope({ kind: "dataSource", dataSourceName: "CRM" }, usage("CRM", "A"))).toBe(true);
    expect(isUsageInExternalSchemaScope({ kind: "browseSource", dataSourceName: "CRM", sourceLocation: "dbo.A" }, usage("ERP", "A"))).toBe(false);
    expect(isUsageInExternalSchemaScope({ kind: "browseRelationship", dataSourceName: "CRM", sourceLocation: "dbo.B" }, usage("CRM", "A"))).toBe(true);
  });

  it("shows every source in the selected data source for an entity-source refresh", () => {
    const scope = { kind: "entitySource", dataSourceName: "CRM", entityRelPath: "Model/A.json", sourceIndex: 1 } as const;
    expect(isUsageInExternalSchemaScope(scope, usage("CRM", "Model/A.json", 1))).toBe(true);
    expect(isUsageInExternalSchemaScope(scope, usage("CRM", "Model/B.json", 0))).toBe(true);
    expect(isUsageInExternalSchemaScope(scope, usage("ERP", "Model/A.json", 1))).toBe(false);
  });

  it("initially selects only the exact entity source for an entity-source refresh", () => {
    const scope = { kind: "entitySource", dataSourceName: "CRM", entityRelPath: "Model/A.json", sourceIndex: 1 } as const;
    expect(isUsageInitiallySelected(scope, usage("CRM", "Model/A.json", 1))).toBe(true);
    expect(isUsageInitiallySelected(scope, usage("CRM", "Model/A.json", 0))).toBe(false);
    expect(isUsageInitiallySelected(scope, usage("CRM", "Model/B.json", 1))).toBe(false);
    expect(isUsageInitiallySelected({ kind: "dataSource", dataSourceName: "CRM" }, usage("CRM", "Model/B.json"))).toBe(true);
  });

  it("groups usages deterministically by data source", () => {
    const groups = groupExternalSchemaUsages([usage("ERP", "B"), usage("CRM", "A"), usage("CRM", "C", 1)]);
    expect(groups.map(([name, items]) => [name, items.length])).toEqual([["CRM", 2], ["ERP", 1]]);
  });

  it("derives group selection state from all contained changes", () => {
    expect(externalSchemaTriState([])).toBe(false);
    expect(externalSchemaTriState([false, false])).toBe(false);
    expect(externalSchemaTriState([true, true])).toBe(true);
    expect(externalSchemaTriState([true, false])).toBe("indeterminate");
  });

  it("shows source context only when an entity has multiple sources in the group", () => {
    const first = usage("CRM", "Model/Customer.json", 0);
    const second = usage("CRM", "Model/Customer.json", 1);
    const product = usage("CRM", "Model/Product.json", 0);
    const siblings = [first, second, product];

    expect(needsExternalSchemaSourceContext(first, siblings)).toBe(true);
    expect(needsExternalSchemaSourceContext(second, siblings)).toBe(true);
    expect(needsExternalSchemaSourceContext(product, siblings)).toBe(false);
  });
});

describe("external schema review defaults", () => {
  it("preselects non-destructive changes only", () => {
    expect(isSchemaChangeSuggested("NEW_COLUMN")).toBe(true);
    expect(isSchemaChangeSuggested("TYPE_CHANGED")).toBe(true);
    expect(isSchemaChangeSuggested("REMOVED_COLUMN")).toBe(false);
    expect(isSchemaChangeSuggested("RELATIONSHIP_REMOVED")).toBe(false);
  });

  it("preserves only relationship mappings supported by selected target columns", () => {
    expect(keepRelationshipMappingsForColumns(
      [{ source: "CustomerId", target: "Id" }, { source: "TenantId", target: "Tenant" }],
      [{ name: "Id" }, { name: "Name" }],
    )).toEqual([{ source: "CustomerId", target: "Id" }]);
  });
});
