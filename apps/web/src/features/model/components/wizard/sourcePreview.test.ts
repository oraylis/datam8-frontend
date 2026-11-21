import { describe, expect, it } from "vitest";
import { buildSourceMetadataEndpoint, buildSourcePreviewEndpoint, derivePreviewColumns, normalizePreviewRows } from "./sourcePreview";

describe("sourcePreview helpers", () => {
  it("uses a table name only when no opaque source handle is available", () => {
    const fallback = new URL(buildSourcePreviewEndpoint("SalesDwh", { name: "Orders" }), "http://localhost");
    expect(fallback.pathname).toBe("/sources/SalesDwh/locations/preview");
    expect(fallback.searchParams.get("source_location")).toBe("Orders");
    expect(fallback.searchParams.get("limit")).toBe("10");

    const advertised = new URL(
      buildSourcePreviewEndpoint("SalesDwh", { schema: "dbo", name: "Orders", sourceLocation: "opaque:/object#x" }, 25),
      "http://localhost",
    );
    expect(advertised.searchParams.get("source_location")).toBe("opaque:/object#x");
    expect(advertised.searchParams.get("limit")).toBe("25");
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
});
