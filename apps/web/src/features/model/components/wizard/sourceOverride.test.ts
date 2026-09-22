import { describe, expect, it } from "vitest";
import { resolveSourceOverride, toSourceOverride } from "./sourceOverride";

describe("sourceOverride", () => {
  it("normalizes explicit plugin source override metadata", () => {
    expect(
      toSourceOverride({
        dataSource: " crm_api ",
        sourceLocation: " /customers ",
      }),
    ).toEqual({
      dataSource: "crm_api",
      sourceLocation: "/customers",
    });
  });

  it("falls back when override data source is not known", () => {
    expect(
      resolveSourceOverride({
        sourceOverride: { dataSource: "missing", sourceLocation: "/customers" },
        fallbackDataSource: "selected",
        fallbackLocation: "[dbo].[customers]",
        dataSources: [{ name: "selected" }],
      }),
    ).toEqual({
      dataSource: "selected",
      sourceLocation: "/customers",
    });
  });
});
