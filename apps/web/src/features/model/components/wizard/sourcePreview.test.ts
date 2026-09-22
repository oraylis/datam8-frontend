import { describe, expect, it } from "vitest";
import { buildSourceMetadataEndpoint, buildSourcePreviewEndpoint, canPreviewDataSource, derivePreviewColumns, normalizePreviewRows } from "./sourcePreview";

describe("sourcePreview helpers", () => {
  it("builds preview endpoint for table without schema", () => {
    const endpoint = buildSourcePreviewEndpoint("SalesDwh", { name: "Orders" });
    expect(endpoint).toContain("/sources/SalesDwh/locations/preview?");
    expect(endpoint).toContain("source_location=Orders");
    expect(endpoint).toContain("limit=10");
  });

  it("builds preview endpoint for schema table", () => {
    const endpoint = buildSourcePreviewEndpoint("SalesDwh", { schema: "dbo", name: "Orders" }, 25);
    expect(endpoint).toContain("/sources/SalesDwh/locations/preview?");
    expect(endpoint).toContain("source_location=dbo.Orders");
    expect(endpoint).toContain("limit=25");
  });

  it("builds metadata endpoint with URLSearchParams encoding", () => {
    const endpoint = buildSourceMetadataEndpoint("Lake", "container@folder/file ä.csv");
    expect(endpoint).toContain("/sources/Lake/locations/metadata?");
    expect(endpoint).toContain("source_location=container%40folder%2Ffile+%C3%A4.csv");
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

  it("disables preview for SQL Server ODCS auth modes", () => {
    expect(
      canPreviewDataSource(
        { connectorId: "sqlserver", extendedProperties: { authMode: "bitbucket_server_bearer_token" } },
        { capabilities: { previewData: true } },
      ),
    ).toBe(false);
  });

  it("enables preview when the connector exposes previewData", () => {
    expect(
      canPreviewDataSource(
        { connectorId: "sqlserver", extendedProperties: { authMode: "databricks_pat" } },
        { capabilities: { previewData: true } },
      ),
    ).toBe(true);
  });
});
