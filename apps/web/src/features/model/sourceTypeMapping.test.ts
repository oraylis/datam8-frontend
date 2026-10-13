import { describe, expect, it } from "vitest";
import { createSourceTypeMapper, mergeInheritedDataTypeMappings, type DataTypeMapping } from "./model-utils";

const mappings = (...pairs: string[][]): DataTypeMapping[] => pairs.map(([sourceType, targetType]) => ({ sourceType, targetType }));

describe("persisted source type mappings", () => {
  it.each([
    [" BIGINT ", mappings(["bigint", "long"]), [], "long"],
    ["DECIMAL(18,2)", mappings(["decimal", "decimal"]), [], "decimal"],
    ["STRUCT<City:STRING>", mappings(["struct", "string"]), [], "string"],
    ["decimal(18,2)", mappings(["decimal", "decimal"], ["DECIMAL(18,2)", "dyndecimal"]), [], "dyndecimal"],
    ["decimal(18,2)", mappings(["decimal(18,2)", "decimal"]), mappings(["DECIMAL", "money"]), "money"],
    ["BIGINT", mappings(["bigint", "long"]), mappings([" bigint ", "int"]), "int"],
  ] as Array<[string, DataTypeMapping[], DataTypeMapping[], string]>)("maps %s with the same precedence as the backend", (raw, types, source, target) => {
    expect(createSourceTypeMapper(types, source, "crm").resolve(raw, { column: "id", sourceLocation: "customers" })).toBe(target);
  });

  it.each(["long", "Unknown", ""])("rejects unmapped %s without an implicit fallback", (raw) => {
    expect(() => createSourceTypeMapper(mappings(["BIGINT", "long"]), [], "crm").resolve(raw, { column: "customer_id", sourceLocation: "customers" })).toThrow(`Data Source 'crm', object 'customers', column 'customer_id': no configured data type mapping for '${raw}'`);
  });

  it.each([false, true])("rejects duplicate keys within one mapping level (%s)", (onSource) => {
    const duplicates = mappings(["BIGINT", "long"], [" bigint ", "int"]);
    expect(() => createSourceTypeMapper(onSource ? [] : duplicates, onSource ? duplicates : [], "crm")).toThrow("duplicate");
  });

  it("displays overrides without a second inherited entry differing only in case", () => {
    expect(mergeInheritedDataTypeMappings(mappings(["BIGINT", "long"], ["date", "date"]), mappings([" bigint ", "int"]))).toEqual(mappings(["date", "date"]));
  });
});
