import { describe, expect, it } from "vitest";
import {
  findBaseItemIndex,
  getBaseItemSelectionKey,
  isBaseItemSelected,
} from "./baseItemSelection";

describe("baseItemSelection", () => {
  it("builds v2 keys for named items", () => {
    const first = { name: "Customer" };
    const firstKey = getBaseItemSelectionKey(first, 0);

    expect(firstKey).toBe("v2:name:Customer::idx:0");
  });

  it("marks only the exact row key as selected", () => {
    const first = { name: "Customer" };
    const second = { name: "Customer" };
    const selectedKey = getBaseItemSelectionKey(second, 1);

    expect(isBaseItemSelected(first, 0, selectedKey)).toBe(false);
    expect(isBaseItemSelected(second, 1, selectedKey)).toBe(true);
  });

  it("finds index by canonical key", () => {
    const items = [{ name: "Customer" }, { name: "Customer" }, { name: "Order" }];
    const selectedKey = getBaseItemSelectionKey(items[1], 1);

    expect(findBaseItemIndex(items, selectedKey)).toBe(1);
  });

  it("returns -1 for non-v2 keys", () => {
    const items = [{ name: "Customer" }, { name: "Customer" }, { name: "Order" }];

    expect(findBaseItemIndex(items, "name:Customer")).toBe(-1);
  });

  it("uses property+name v2 key for property values", () => {
    const first = { property: "Country", name: "DE" };
    expect(getBaseItemSelectionKey(first, 2)).toBe("v2:property:Country::name:DE::idx:2");
  });

  it("uses row fallback when no identity fields are present", () => {
    const row = {};
    expect(getBaseItemSelectionKey(row, 3)).toBe("v2:row::idx:3");
  });
});

