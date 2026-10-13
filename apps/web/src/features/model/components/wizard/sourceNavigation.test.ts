import { describe, expect, it } from "vitest";
import { collectSelectableLocations, normalizeLocations, normalizeSourceMetadata, type SourceLocationItem } from "./sourceNavigation";

const item = (name: string, type: string, sourceLocation = name): SourceLocationItem => ({ name, type, sourceLocation });

describe("plugin-independent source navigation", () => {
  it("traverses every container type, avoids cycles and selects files as leaves", async () => {
    const calls: Array<string | undefined> = [];
    const tree: Record<string, SourceLocationItem[]> = {
      "": [item("Root", "SCHEMA", "opaque/root")],
      "opaque/root": [item("Folder", "DIRECTORY", "node#1"), item("Table", "TABLE", "raw://table")],
      "node#1": [item("Contract", "CONTAINER", "node?2")],
      "node?2": [item("Root", "SCHEMA", "opaque/root"), item("File", "FILE", " path/ü.csv ")],
    };
    const result = await collectSelectableLocations(async (location) => {
      calls.push(location);
      return tree[location || ""];
    });
    expect(result.map((entry) => entry.sourceLocation)).toEqual(["raw://table", " path/ü.csv "]);
    expect(calls).toEqual([undefined, "opaque/root", "node#1", "node?2"]);
  });

  it("bounds parallel requests and reports a failed container instead of hiding it", async () => {
    let active = 0;
    let peak = 0;
    await collectSelectableLocations(async (location) => {
      if (!location) return Array.from({ length: 12 }, (_, i) => item(`${i}`, "CONTAINER"));
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return [item(`leaf${location}`, "OBJECT")];
    });
    expect(peak).toBe(4);
    await expect(collectSelectableLocations(async () => { throw new Error("Invalid contract"); })).rejects.toThrow("Invalid contract");
  });

  it("requires backend handles and preserves names, overrides and arbitrary types", () => {
    const row = { name: "Name / ü", type: "NEW_PROVIDER_TYPE", sourceLocation: "opaque#name%2F", sourceOverride: { sourceLocation: "read?query" } };
    expect(normalizeLocations({ items: [row] })[0]).toMatchObject(row);
    expect(() => normalizeLocations({ items: [{ name: "Missing handle" }] })).toThrow("sourceLocation");
  });

  it("uses object metadata and keeps the physical source type, scale zero and read override", () => {
    const metadata = normalizeSourceMetadata({
      object: { name: "technical_name", schema: "schema", type: "TABLE", description: "From provider" },
      sourceLocation: "opaque:/metadata#1", sourceOverride: { sourceLocation: "physical:/data" },
      items: [{ name: "amount", ordinal: 1, dataType: "VendorDecimal", isNullable: false, numericPrecision: 10, numbericScale: 0 }],
    }, "ignored://fallback");
    expect(metadata).toMatchObject({ name: "technical_name", sourceLocation: "opaque:/metadata#1", sourceOverride: { sourceLocation: "physical:/data" } });
    expect(metadata.columns[0]).toMatchObject({ dataType: "VendorDecimal", numericScale: 0, numericPrecision: 10 });
  });
});
