import { describe, expect, it } from "vitest";
import { buildSourcePreviewEndpoint, derivePreviewColumns, normalizePreviewRows } from "./sourcePreview";

describe("sourcePreview helpers", () => {
  it("builds preview endpoint for table without schema", () => {
    const endpoint = buildSourcePreviewEndpoint("SalesDwh", { name: "Orders" });
    expect(endpoint).toContain("/sources/SalesDwh/tables/Orders/preview?limit=10");
  });

  it("builds preview endpoint for schema table", () => {
    const endpoint = buildSourcePreviewEndpoint("SalesDwh", { schema: "dbo", name: "Orders" }, 25);
    expect(endpoint).toContain("/sources/SalesDwh/schemas/dbo/tables/Orders/preview?limit=25");
  });

  it("normalizes rows from multi-item response", () => {
    const rows = normalizePreviewRows({
      items: [{ id: 1, name: "A" }, null, ["x"], { id: 2, name: "B" }],
    });
    expect(rows).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]);
  });

  it("derives columns in first-seen order", () => {
    const columns = derivePreviewColumns([
      { id: 1, name: "A" },
      { id: 2, createdAt: "2026-04-20" },
    ]);
    expect(columns).toEqual(["id", "name", "createdAt"]);
  });
});
