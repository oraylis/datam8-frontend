import { describe, expect, it } from "vitest";
import { buildPropertyValueGroups } from "./propertyValueGroups";

describe("buildPropertyValueGroups", () => {
  it("groups property values by property in first-seen order", () => {
    const result = buildPropertyValueGroups([
      { property: "domain", name: "sales" },
      { property: "priority", name: "high" },
      { property: "domain", name: "finance" },
    ]);

    expect(result.map((group) => group.propertyLabel)).toEqual(["domain", "priority"]);
    expect(result[0]?.items.map((entry) => entry.index)).toEqual([0, 2]);
    expect(result[1]?.items.map((entry) => entry.index)).toEqual([1]);
  });

  it("collects missing properties under the unassigned bucket", () => {
    const result = buildPropertyValueGroups([
      { name: "sales" },
      { property: " ", name: "finance" },
      { property: "domain", name: "hr" },
    ]);

    expect(result.map((group) => group.propertyLabel)).toEqual(["Unassigned property", "domain"]);
    expect(result[0]?.items.map((entry) => entry.index)).toEqual([0, 1]);
  });
});
