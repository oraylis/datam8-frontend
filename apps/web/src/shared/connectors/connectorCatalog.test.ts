import { afterEach, describe, expect, it, vi } from "vitest";
import { getConnectors, refresh } from "./connectorCatalog";

describe("connectorCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses connector dataTypeMapping and drops invalid/duplicate rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "sqlserver",
              displayName: "SQL Server",
              version: "0.1.0",
              capabilities: ["uiSchema", "validationConnection", "metadata", "previewData"],
              dataTypeMapping: [
                { sourceType: "int", targetType: "int" },
                { sourceType: "INT", targetType: "long" },
                { sourceType: "", targetType: "string" },
                { sourceType: "varchar", targetType: "string" },
              ],
            },
          ],
        }),
      }),
    );

    await refresh();
    expect(getConnectors()).toEqual([
      {
        id: "sqlserver",
        displayName: "SQL Server",
        version: "0.1.0",
        capabilities: {
          uiSchema: true,
          validateConnection: true,
          previewData: true,
          metadata: { listTables: true, getTableMetadata: true },
        },
        dataTypeMapping: [
          { sourceType: "int", targetType: "int" },
          { sourceType: "varchar", targetType: "string" },
        ],
      },
    ]);
  });
});
