import { describe, expect, it } from "vitest";
import { toPropertyChipItems, toUsedPropertyNameSet } from "./EntitySourcesEditor";

describe("EntitySourcesEditor property helpers", () => {
  it("creates chip items and filters empty property names", () => {
    const items = toPropertyChipItems(
      [
        { property: "PII", value: "yes" },
        { property: "   ", value: "ignored" },
      ],
      "map-1",
      "Mapping property",
    );

    expect(items).toEqual([
      {
        key: "map-1-0-PII",
        property: "PII",
        value: "yes",
        inherited: false,
        title: "Mapping property",
        removeKey: 0,
      },
    ]);
  });

  it("returns an empty item list for undefined properties", () => {
    expect(toPropertyChipItems(undefined, "map-2", "Mapping property")).toEqual([]);
  });

  it("builds used-property set from non-empty names", () => {
    const used = toUsedPropertyNameSet([
      { property: "Classification", value: "gold" },
      { property: "", value: "ignored" },
      { property: "PII", value: "yes" },
    ]);

    expect(Array.from(used).sort()).toEqual(["Classification", "PII"]);
  });
});
