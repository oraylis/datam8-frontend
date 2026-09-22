import { describe, expect, it } from "vitest";
import {
  folderLocatorFromFolderPath,
  modelFolderPathFromRelPath,
  modelFolderLocatorFromFolderPath,
  rebaseModelRelPath,
} from "./locator-utils";

describe("locator-utils", () => {
  it("builds folder metadata locators", () => {
    expect(folderLocatorFromFolderPath("Raw/Sales")).toBe("/folders/Raw/Sales");
  });

  it("builds model folder subtree locators with a trailing slash", () => {
    expect(modelFolderLocatorFromFolderPath("Model/Raw/Sales")).toBe("/modelEntities/Raw/Sales/");
    expect(modelFolderLocatorFromFolderPath("Raw/Sales")).toBe("/modelEntities/Raw/Sales/");
  });

  it("extracts and rebases folders without assuming the model root casing", () => {
    expect(modelFolderPathFromRelPath("model/020_gold/old/child/entity.json")).toBe("020_gold/old/child");
    expect(rebaseModelRelPath("model/020_gold/old/child/entity.json", "020_gold/old", "020_gold/new")).toBe(
      "model/020_gold/new/child/entity.json",
    );
    expect(rebaseModelRelPath("CustomModel/020_gold/other/entity.json", "020_gold/old", "020_gold/new")).toBe(
      "CustomModel/020_gold/other/entity.json",
    );
  });
});
