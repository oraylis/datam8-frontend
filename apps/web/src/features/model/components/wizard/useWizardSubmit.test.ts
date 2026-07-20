import { describe, expect, it } from "vitest";
import type { PropertyAssignment } from "@datam8/types";
import {
  buildEntityNameResolver,
  mapInternalAttributesFromEntity,
  mapMetadataColumnToCreatedAttribute,
  toMappedRelationshipsFromMetadata,
} from "./useWizardSubmit";

describe("mapMetadataColumnToCreatedAttribute", () => {
  it("maps optional column description and properties to created attributes", () => {
    const properties: PropertyAssignment[] = [{ property: "classification", value: "restricted" }];
    const result = mapMetadataColumnToCreatedAttribute({
      column: {
        name: "CustomerId",
        ordinal: 1,
        dataType: "string",
        maxLength: 50,
        numericPrecision: null,
        numericScale: null,
        isNullable: false,
        isPrimaryKey: true,
        description: "Business customer key",
        properties,
      },
      index: 0,
      nowIso: "2026-01-01T00:00:00.000Z",
      effectiveMappings: [],
      canonicalDataTypes: ["string", "int", "boolean"],
    });

    expect(result.name).toBe("CustomerId");
    expect(result.description).toBe("Business customer key");
    expect(result.properties).toEqual(properties);
    expect(result.isBusinessKey).toBe(true);
    expect(result.dataType.type).toBe("string");
  });
});

describe("mapInternalAttributesFromEntity", () => {
  it("copies internal attributes 1:1 with fallback defaults", () => {
    const nowIso = "2026-01-01T00:00:00.000Z";
    const result = mapInternalAttributesFromEntity({
      nowIso,
      attributes: [
        {
          name: "CustomerId",
          description: "PK",
          attributeType: "BusinessKey",
          dataType: { type: "int64", nullable: false },
          isBusinessKey: true,
          dateAdded: "2025-12-31T00:00:00.000Z",
          properties: [{ property: "classification", value: "restricted" }],
        },
        {
          dataType: { type: "string", nullable: true },
        },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      ordinalNumber: 1,
      name: "CustomerId",
      description: "PK",
      attributeType: "BusinessKey",
      isBusinessKey: true,
      dateAdded: "2025-12-31T00:00:00.000Z",
    });
    expect(result[1]).toMatchObject({
      ordinalNumber: 2,
      name: "Attribute2",
      attributeType: "Regular",
      dateAdded: nowIso,
    });
  });
});

describe("toMappedRelationshipsFromMetadata", () => {
  it("resolves internal relationship candidates only for unique entity names", () => {
    const resolver = buildEntityNameResolver([
      { name: "provider", content: { id: 10, name: "provider", displayName: "Provider" } },
      { name: "contract_instance", content: { id: 20, name: "contract_instance" } },
      { name: "contract_instance_copy", content: { id: 21, name: "contract_instance" } },
    ] as any);

    const result = toMappedRelationshipsFromMetadata(
      {
        schema: "dm_dom_mobile_access",
        name: "mobile_number_porting",
        type: "BASE TABLE",
        columns: [
          {
            name: "receiving_internal_provider_id",
            ordinal: 1,
            dataType: "integer",
            maxLength: null,
            numericPrecision: null,
            numericScale: null,
            isNullable: false,
            isPrimaryKey: false,
            relationships: [
              {
                relationshipType: "internal",
                targetEntityName: "provider",
                sourceName: "receiving_internal_provider_id",
                targetName: "provider_id",
                alias: "provider",
              },
            ],
          },
          {
            name: "receiving_subscriber_id",
            ordinal: 2,
            dataType: "integer",
            maxLength: null,
            numericPrecision: null,
            numericScale: null,
            isNullable: false,
            isPrimaryKey: false,
            relationships: [
              {
                relationshipType: "internal",
                targetEntityName: "contract_instance",
                sourceName: "receiving_subscriber_id",
                targetName: "subscriber_id",
              },
            ],
          },
        ],
      },
      resolver,
    );

    expect(result).toEqual([
      {
        targetLocation: 10,
        alias: "provider",
        attributes: [{ sourceName: "receiving_internal_provider_id", targetName: "provider_id" }],
      },
    ]);
  });
});
