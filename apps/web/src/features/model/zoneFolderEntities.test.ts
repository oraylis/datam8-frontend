import { describe, expect, it } from "vitest";
import type { BaseEntity, FolderEntity } from "./model-types";
import { createMissingZoneFolderEntities, hasFolderPropertiesFile } from "./zoneFolderEntities";

const zonesEntity: BaseEntity = {
  name: "Zones.json",
  relPath: "Base/Zones.json",
  content: {
    zones: [
      { name: "Raw", localFolderName: "010-Raw", properties: [{ property: "zone", value: "kept" }] },
      { name: "Nested", localFolderName: "010-Raw/Nested" },
      { name: "No folder", localFolderName: "" },
    ],
  },
};

describe("createMissingZoneFolderEntities", () => {
  it("creates metadata for zone roots and any intermediate folders", () => {
    const result = createMissingZoneFolderEntities([zonesEntity], []);

    expect(result.map((entry) => entry.folderPath)).toEqual(["010-Raw", "010-Raw/Nested"]);
    expect(result[0]).toMatchObject({
      locator: "/folders/010-Raw",
      relPath: "Model/010-Raw/.properties.json",
      content: { name: "010-Raw", path: "010-Raw", properties: [] },
    });
    expect(result[1].locator).toBe("/folders/010-Raw/Nested");
    expect(result[0].content.id).toBeGreaterThan(0);
    expect(result[1].content.id).toBeGreaterThan(0);
    expect((zonesEntity.content.zones?.[0] as any).properties).toEqual([{ property: "zone", value: "kept" }]);
  });

  it("leaves existing folder entities alone and only creates missing zone paths", () => {
    const existing: FolderEntity = {
      locator: "/folders/010-Raw",
      name: "Raw",
      relPath: "Model/010-Raw/.properties.json",
      folderPath: "010-Raw",
      content: { id: 4, name: "Custom name", path: "010-Raw", properties: [{ property: "p", value: "v" }] },
    };

    const result = createMissingZoneFolderEntities([zonesEntity], [existing]);

    expect(result).toHaveLength(1);
    expect(result[0].folderPath).toBe("010-Raw/Nested");
    expect(existing.content.name).toBe("Custom name");
  });

  it("recognizes backend placeholder folders without a properties file", () => {
    const placeholder: FolderEntity = {
      locator: "/folders/010-Raw",
      name: "010-Raw",
      relPath: "Model/010-Raw/.properties.json",
      folderPath: "010-Raw",
      content: {
        id: 4,
        name: "010-Raw",
        displayName: null,
        description: null,
        path: null,
        dataProduct: null,
        dataModule: null,
        properties: null,
      },
    } as unknown as FolderEntity;

    expect(hasFolderPropertiesFile(placeholder)).toBe(false);
    expect(createMissingZoneFolderEntities([zonesEntity], [placeholder])).toHaveLength(2);
  });
});
