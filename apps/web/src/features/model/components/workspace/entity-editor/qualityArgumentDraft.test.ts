import { describe, expect, it } from "vitest";
import {
  argumentEntries,
  argumentEntriesJson,
  changeArgumentType,
  newArgument,
} from "./qualityArgumentDraft";
import { parseQualityArguments } from "./quality";

describe("structured quality arguments", () => {
  it("preserves nested JSON types, arbitrary keys and empty containers", () => {
    const value = JSON.parse(
      '{"column":"Amount","limit":0.95,"allow_nulls":false,"items":[null,true,0,"text",{"nested":[]}],"empty":{},"__proto__":{"value":1},"": "empty key"}',
    );
    const entries = argumentEntries(value);
    expect(parseQualityArguments(argumentEntriesJson(entries))).toEqual(value);
    expect(argumentEntriesJson(entries)).not.toContain('"id":');
  });
  it("keeps incomplete numeric text local and refuses duplicate object keys", () => {
    const entries = argumentEntries({ limit: 0 });
    entries[0].value = "1e";
    expect(() => argumentEntriesJson(entries)).toThrow("valid number");
    entries[0].value = "9007199254740993";
    expect(argumentEntriesJson(entries)).toContain("9007199254740993");
    expect(() => parseQualityArguments(argumentEntriesJson(entries))).toThrow(
      "loss of precision",
    );
    expect(() =>
      argumentEntriesJson([...entries, { ...entries[0], id: "duplicate" }]),
    ).toThrow("unique");
  });
  it("adds distinct names and changes types only after an explicit selection", () => {
    const entries = argumentEntries({ argument: "Id", argument_2: true });
    expect(newArgument(entries).name).toBe("argument_3");
    const list = changeArgumentType(entries[0], "array");
    expect(list.id).toBe(entries[0].id);
    expect(list.children).toEqual([]);
    expect(changeArgumentType(entries[0], "string")).toBe(entries[0]);
  });
  it("keeps list order and permits identical values and unnamed list items", () => {
    const entries = argumentEntries({ columns: ["A", "A", "B"] });
    entries[0].children.reverse();
    expect(parseQualityArguments(argumentEntriesJson(entries))).toEqual({
      columns: ["B", "A", "A"],
    });
  });
});
