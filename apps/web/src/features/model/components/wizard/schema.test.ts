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

  it("requires folderPath, selectedSource and selectedTables for from-source mode", () => {
    const result = wizardSchema.safeParse({
      creationMode: "from-source",
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
});
