import { describe, expect, it } from "vitest";
import { findBaseItemIndex, getBaseItemSelectionKey, isBaseItemSelected } from "./baseItemSelection";

describe("base item selection", () => {
  it("selects the requested duplicate-name row", () => {
    const items = [{ name: "Customer" }, { name: "Customer" }, { name: "Order" }];
    const selectedKey = getBaseItemSelectionKey(items[1], 1);

    expect(isBaseItemSelected(items[0], 0, selectedKey)).toBe(false);
    expect(isBaseItemSelected(items[1], 1, selectedKey)).toBe(true);
    expect(findBaseItemIndex(items, selectedKey)).toBe(1);
  });

  it("distinguishes property values with the same name and supports unnamed rows", () => {
    const values = [{ property: "Country", name: "DE" }, { property: "Language", name: "DE" }];
    const languageValue = getBaseItemSelectionKey(values[1], 1);
    expect(findBaseItemIndex(values, languageValue)).toBe(1);
    expect(isBaseItemSelected(values[0], 0, languageValue)).toBe(false);

    const unnamed = [{}, {}];
    const secondUnnamed = getBaseItemSelectionKey(unnamed[1], 1);
    expect(findBaseItemIndex(unnamed, secondUnnamed)).toBe(1);
    expect(isBaseItemSelected(unnamed[0], 0, secondUnnamed)).toBe(false);
  });
});
