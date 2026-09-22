import { describe, expect, it } from "vitest";
import {
  createPropertyRefactorPayload,
  diffPropertyChanges,
  diffPropertyValueChanges,
} from "./propertyRefactor";

describe("propertyRefactor", () => {
  it("detects single property rename", () => {
    const prevContent = { properties: [{ name: "domain" }] };
    const nextContent = { properties: [{ name: "businessDomain" }] };

    expect(diffPropertyChanges(prevContent, nextContent)).toEqual({
      propertyRenames: [{ oldName: "domain", newName: "businessDomain" }],
      deletedProperties: [],
    });
  });

  it("detects deleted properties", () => {
    const prevContent = { properties: [{ name: "domain" }, { name: "retention" }] };
    const nextContent = { properties: [{ name: "domain" }] };

    expect(diffPropertyChanges(prevContent, nextContent)).toEqual({
      propertyRenames: [],
      deletedProperties: ["retention"],
    });
  });

  it("detects value rename per property", () => {
    const prevContent = { propertyValues: [{ property: "domain", name: "sales" }] };
    const nextContent = { propertyValues: [{ property: "domain", name: "finance" }] };

    expect(diffPropertyValueChanges(prevContent, nextContent)).toEqual({
      valueRenames: [{ property: "domain", oldValue: "sales", newValue: "finance" }],
      deletedValues: [],
      valueMoves: [],
    });
  });

  it("detects moving a value to a different property", () => {
    const prevContent = { propertyValues: [{ property: "domain", name: "sales" }] };
    const nextContent = { propertyValues: [{ property: "businessDomain", name: "sales" }] };

    expect(diffPropertyValueChanges(prevContent, nextContent)).toEqual({
      valueRenames: [],
      deletedValues: [],
      valueMoves: [
        {
          oldProperty: "domain",
          oldValue: "sales",
          newProperty: "businessDomain",
          newValue: "sales",
        },
      ],
    });
  });

  it("does not infer a cross-property move from unrelated delete/rename combinations", () => {
    const prevContent = {
      propertyValues: [
        { property: "jobs", name: "daily" },
        { property: "jobs", name: "weekly" },
        { property: "schedules", name: "legacy" },
      ],
    };
    const nextContent = {
      propertyValues: [
        { property: "jobs", name: "daily" },
        { property: "schedules", name: "daily" },
        { property: "schedules", name: "legacy" },
      ],
    };

    expect(diffPropertyValueChanges(prevContent, nextContent)).toEqual({
      valueRenames: [],
      deletedValues: [{ property: "jobs", value: "weekly" }],
      valueMoves: [],
    });
  });

  it("treats deleting one of two values as delete, not rename by index shift", () => {
    const prevContent = {
      propertyValues: [
        { property: "jobs", name: "daily" },
        { property: "jobs", name: "weekly" },
      ],
    };
    const nextContent = {
      propertyValues: [
        { property: "jobs", name: "weekly" },
      ],
    };

    expect(diffPropertyValueChanges(prevContent, nextContent)).toEqual({
      valueRenames: [],
      deletedValues: [{ property: "jobs", value: "daily" }],
      valueMoves: [],
    });
  });

  it("does not emit refactor changes when previous values were empty placeholders", () => {
    const prevProps = { properties: [{ name: "" }] };
    const nextProps = { properties: [{ name: "businessDomain" }] };
    expect(diffPropertyChanges(prevProps, nextProps)).toEqual({
      propertyRenames: [],
      deletedProperties: [],
    });

    const prevValues = { propertyValues: [{ property: "domain", name: "" }] };
    const nextValues = { propertyValues: [{ property: "domain", name: "sales" }] };
    expect(diffPropertyValueChanges(prevValues, nextValues)).toEqual({
      valueRenames: [],
      deletedValues: [],
      valueMoves: [],
    });
  });

  it("does not mark renamed values as deleted when multiple renames happen", () => {
    const prevContent = {
      propertyValues: [
        { property: "domain", name: "sales" },
        { property: "domain", name: "finance" },
        { property: "category", name: "legacy" },
        { property: "category", name: "core" },
      ],
    };
    const nextContent = {
      propertyValues: [
        { property: "domain", name: "sales_new" },
        { property: "domain", name: "finance_new" },
        { property: "category", name: "sales" },
        { property: "category", name: "core" },
      ],
    };

    expect(diffPropertyValueChanges(prevContent, nextContent)).toEqual({
      valueRenames: [
        { property: "domain", oldValue: "sales", newValue: "sales_new" },
        { property: "domain", oldValue: "finance", newValue: "finance_new" },
        { property: "category", oldValue: "legacy", newValue: "sales" },
      ],
      deletedValues: [],
      valueMoves: [],
    });
  });

  it("builds payload only when changes are present", () => {
    expect(
      createPropertyRefactorPayload({
        propertyRenames: [],
        valueRenames: [],
        deletedProperties: [],
        deletedValues: [],
        valueMoves: [],
      }),
    ).toBeNull();

    expect(
      createPropertyRefactorPayload({
        propertyRenames: [{ oldName: "a", newName: "b" }],
      }),
    ).toEqual({
      propertyRenames: [{ oldName: "a", newName: "b" }],
      valueRenames: [],
      deletedProperties: [],
      deletedValues: [],
      valueMoves: [],
    });
  });
});
