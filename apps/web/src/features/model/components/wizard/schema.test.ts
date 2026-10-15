import { describe, expect, it } from "vitest";
import { wizardSchema } from "./schema";

describe("wizard schema folder selection rules", () => {
  it("requires folderPath for manual mode", () => {
    const result = wizardSchema.safeParse({
      creationMode: "manual",
      name: "Customer",
      folderPath: "",
      sources: [],
      attributes: [],
      relationships: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const folderIssue = result.error.issues.find((issue) => issue.path.join(".") === "folderPath");
      expect(folderIssue?.message).toBe("Folder is required");
    }
  });

  it("requires folderPath, selectedSource and selectedTables for external from-source mode", () => {
    const result = wizardSchema.safeParse({
      creationMode: "from-source",
      selectedSourceKind: "external",
      folderPath: "",
      selectedSource: "",
      selectedTables: [],
      sources: [],
      attributes: [],
      relationships: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
      expect(messages).toContain("folderPath:Folder is required");
      expect(messages).toContain("selectedSource:Source is required");
      expect(messages).toContain("selectedTables:Select at least one table");
    }
  });

  it("requires selectedInternalEntities for internal from-source mode", () => {
    const result = wizardSchema.safeParse({
      creationMode: "from-source",
      selectedSourceKind: "internal",
      folderPath: "ZoneA/ProductA",
      selectedInternalEntities: [],
      sources: [],
      attributes: [],
      relationships: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
      expect(messages).toContain("selectedInternalEntities:Select at least one entity");
    }
  });
});

describe("wizard relationship schema", () => {
  const baseManualValues = {
    creationMode: "manual" as const,
    name: "Order",
    folderPath: "Core/Sales",
    sources: [],
    attributes: [{ name: "CustomerId", dataType: "int", attributeType: "Regular" }],
  };

  it("accepts an external relationship with data source, target location and mapping", () => {
    const result = wizardSchema.safeParse({
      ...baseManualValues,
      relationships: [
        {
          type: "external",
          dataSource: "crm",
          targetLocation: "dbo.Customer",
          sourceAttribute: "CustomerId",
          targetAttribute: "Id",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an external relationship without target location", () => {
    const result = wizardSchema.safeParse({
      ...baseManualValues,
      relationships: [
        {
          type: "external",
          dataSource: "crm",
          targetLocation: "",
          sourceAttribute: "CustomerId",
          targetAttribute: "Id",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
