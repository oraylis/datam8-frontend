import { describe, expect, it } from "vitest";
import { validateBaseContent } from "./validation";

describe("validateBaseContent duplicate names", () => {
  it("flags duplicate data source names case-insensitively", () => {
    const result = validateBaseContent("dataSources", {
      dataSources: [
        { name: "CRM", type: "Sql" },
        { name: " crm ", type: "Sql" },
      ],
    });

    expect(result.errors.some((message) => message.includes("Data Source names must be unique"))).toBe(true);
  });

  it("flags duplicate module names inside a data product", () => {
    const result = validateBaseContent("dataProducts", {
      dataProducts: [
        {
          name: "Sales",
          dataModules: [
            { name: "Core" },
            { name: " core " },
          ],
        },
      ],
    });

    expect(result.errors.some((message) => message.includes("duplicate module names"))).toBe(true);
  });

  it("accepts zone properties assignments", () => {
    const result = validateBaseContent("zones", {
      zones: [
        {
          name: "Stage",
          displayName: "Stage",
          targetName: "stage",
          localFolderName: "010-Stage",
          properties: [{ property: "domain", value: "sales" }],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.missing)).toHaveLength(0);
  });

  it("flags duplicate property names", () => {
    const result = validateBaseContent("properties", {
      properties: [
        { name: "Country", displayName: "Country" },
        { name: "country", displayName: "Country duplicate" },
      ],
    });

    expect(result.errors.some((message) => message.includes("Property names must be unique"))).toBe(true);
  });

  it("flags missing scope type for properties", () => {
    const result = validateBaseContent("properties", {
      properties: [
        {
          name: "Lifecycle",
          displayName: "Lifecycle",
          scopes: [{ type: "" }],
        },
      ],
    });

    expect(result.missing["Lifecycle"]?.has("scope:0:type")).toBe(true);
  });

  it("allows non-standard scope types for compatibility", () => {
    const result = validateBaseContent("properties", {
      properties: [
        {
          name: "Lifecycle",
          displayName: "Lifecycle",
          scopes: [{ type: "entity" }],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.missing)).toHaveLength(0);
  });

  it("flags duplicate scope types for properties", () => {
    const result = validateBaseContent("properties", {
      properties: [
        {
          name: "Lifecycle",
          displayName: "Lifecycle",
          scopes: [{ type: "folder" }, { type: "Folder" }],
        },
      ],
    });

    expect(result.errors.some((message) => message.includes("duplicate scope type"))).toBe(true);
  });

  it("accepts valid property scopes", () => {
    const result = validateBaseContent("properties", {
      properties: [
        {
          name: "Lifecycle",
          displayName: "Lifecycle",
          schema: "string",
          scopes: [
            { type: "folder", singleUsage: true, mandatory: false },
            { type: "model", singleUsage: false, mandatory: true },
            { type: "base", singleUsage: true, mandatory: false },
          ],
        },
      ],
    });

    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.missing)).toHaveLength(0);
  });

  it("flags missing required fields for property values", () => {
    const result = validateBaseContent("propertyValues", {
      propertyValues: [
        { property: "", name: "daily" },
        { property: "schedule", name: "" },
      ],
    });

    expect(Object.keys(result.missing).length).toBeGreaterThan(0);
  });

  it("flags duplicate value names within the same property", () => {
    const result = validateBaseContent("propertyValues", {
      propertyValues: [
        { property: "schedule", name: "daily" },
        { property: " schedule ", name: " daily " },
      ],
    });

    expect(result.errors.some((message) => message.includes("Property Value names must be unique per property"))).toBe(true);
  });
});
