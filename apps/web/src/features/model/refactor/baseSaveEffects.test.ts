import { describe, expect, it } from "vitest";
import type { ModelEntity } from "../model-types";
import { collectDataProductFolderRenames, collectZoneFolderDeletes, collectZoneFolderRenames } from "./baseSaveEffects";

describe("baseSaveEffects", () => {
  it("detects zone localFolderName rename operations", () => {
    const prev = { zones: [{ name: "Zone A", localFolderName: "ZoneA" }] };
    const next = { zones: [{ name: "Zone A", localFolderName: "ZoneX" }] };

    expect(collectZoneFolderRenames(prev, next)).toEqual([
      { fromFolder: "Model/ZoneA", toFolder: "Model/ZoneX" },
    ]);
  });

  it("detects deleted zone folders while ignoring rename sources", () => {
    const prev = {
      zones: [
        { name: "Zone A", localFolderName: "ZoneA" },
        { name: "Zone B", localFolderName: "ZoneB" },
      ],
    };
    const next = {
      zones: [{ name: "Zone A", localFolderName: "ZoneAX" }],
    };

    expect(collectZoneFolderDeletes(prev, next)).toEqual(["Model/ZoneB"]);
  });

  it("does not detect zone rename when previous entry had no real folder content", () => {
    const prev = { zones: [{ name: "", localFolderName: "" }] };
    const next = { zones: [{ name: "Zone A", localFolderName: "ZoneA" }] };

    expect(collectZoneFolderRenames(prev, next)).toEqual([]);
    expect(collectZoneFolderDeletes(prev, next)).toEqual([]);
  });

  it("detects data product and module rename operations per zone", () => {
    const prev = {
      dataProducts: [
        {
          name: "ProductA",
          dataModules: [{ name: "ModuleA" }],
        },
      ],
    };
    const next = {
      dataProducts: [
        {
          name: "ProductX",
          dataModules: [{ name: "ModuleX" }],
        },
      ],
    };
    const modelEntities: ModelEntity[] = [
      {
        locator: "/Model/ZoneA/ProductA/ModuleA/Customer",
        name: "Customer",
        relPath: "Model/ZoneA/ProductA/ModuleA/Customer.json",
        content: {},
      },
      {
        locator: "/Model/ZoneB/ProductA/ModuleA/Orders",
        name: "Orders",
        relPath: "Model/ZoneB/ProductA/ModuleA/Orders.json",
        content: {},
      },
    ];

    expect(collectDataProductFolderRenames({ prevContent: prev, nextContent: next, modelEntities })).toEqual([
      { fromFolder: "Model/ZoneA/ProductA", toFolder: "Model/ZoneA/ProductX" },
      { fromFolder: "Model/ZoneB/ProductA", toFolder: "Model/ZoneB/ProductX" },
      { fromFolder: "Model/ZoneA/ProductX/ModuleA", toFolder: "Model/ZoneA/ProductX/ModuleX" },
      { fromFolder: "Model/ZoneB/ProductX/ModuleA", toFolder: "Model/ZoneB/ProductX/ModuleX" },
    ]);
  });
});
