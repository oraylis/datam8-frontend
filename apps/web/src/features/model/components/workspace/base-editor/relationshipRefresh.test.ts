import { describe, expect, it } from "vitest";
import {
  applyRelationshipChange,
  buildRefreshEntityNameResolver,
  diffRelationships,
  normalizeEntityRelationships,
  relationshipsFromSourceFields,
} from "./relationshipRefresh";

describe("relationshipRefresh", () => {
  it("detects added, removed, and changed relationship mappings", () => {
    const current = [
      {
        dataSource: "edwh-prod",
        targetLocation: "[dbo].[provider]",
        alias: "provider",
        attributes: [{ sourceName: "provider_id", targetName: "provider_id" }],
      },
      {
        dataSource: "edwh-prod",
        targetLocation: "[dbo].[legacy]",
        attributes: [{ sourceName: "legacy_id", targetName: "id" }],
      },
    ];
    const desired = relationshipsFromSourceFields([
      {
        name: "provider_id",
        relationships: [
          {
            dataSource: "edwh-prod",
            targetLocation: "[dbo].[provider]",
            alias: "provider",
            sourceName: "provider_id",
            targetName: "provider_key",
          },
        ],
      },
      {
        name: "subscriber_id",
        relationships: [
          {
            dataSource: "edwh-prod",
            targetLocation: "[dbo].[subscriber]",
            sourceName: "subscriber_id",
            targetName: "subscriber_id",
          },
        ],
      },
    ]);

    expect(diffRelationships(current, desired).map((change) => change.changeType).sort()).toEqual([
      "RELATIONSHIP_ADDED",
      "RELATIONSHIP_MAPPING_CHANGED",
      "RELATIONSHIP_REMOVED",
    ]);
  });

  it("resolves internal candidates only for unique entity names", () => {
    const resolver = buildRefreshEntityNameResolver([
      { name: "provider", content: { id: 7, name: "provider" } },
      { name: "contract_instance", content: { id: 8, name: "contract_instance" } },
      { name: "contract_instance_copy", content: { id: 9, name: "contract_instance" } },
    ]);

    const desired = relationshipsFromSourceFields(
      [
        {
          name: "provider_id",
          relationships: [
            {
              relationshipType: "internal",
              targetEntityName: "provider",
              sourceName: "provider_id",
              targetName: "provider_id",
            },
          ],
        },
        {
          name: "subscriber_id",
          relationships: [
            {
              relationshipType: "internal",
              targetEntityName: "contract_instance",
              sourceName: "subscriber_id",
              targetName: "subscriber_id",
            },
          ],
        },
      ],
      resolver,
    );

    expect(desired).toHaveLength(1);
    expect(desired[0]).toMatchObject({
      targetLocation: 7,
      attributes: [{ sourceName: "provider_id", targetName: "provider_id" }],
    });
  });

  it("applies selected relationship changes without touching unrelated rows", () => {
    const current = [
      {
        dataSource: "edwh-prod",
        targetLocation: "[dbo].[provider]",
        attributes: [{ sourceName: "provider_id", targetName: "provider_id" }],
      },
      {
        dataSource: "manual",
        targetLocation: "manual_target",
        attributes: [{ sourceName: "manual_id", targetName: "id" }],
      },
    ];
    const desired = relationshipsFromSourceFields([
      {
        name: "provider_id",
        relationships: [
          {
            dataSource: "edwh-prod",
            targetLocation: "[dbo].[provider]",
            sourceName: "provider_id",
            targetName: "provider_key",
          },
        ],
      },
    ]);
    const change = diffRelationships(current, desired).find((entry) => entry.changeType === "RELATIONSHIP_MAPPING_CHANGED");

    expect(change).toBeTruthy();
    const next = applyRelationshipChange(current, change!);
    expect(normalizeEntityRelationships(next)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataSource: "manual",
          targetLocation: "manual_target",
          attributes: [{ sourceName: "manual_id", targetName: "id" }],
        }),
        expect.objectContaining({
          dataSource: "edwh-prod",
          targetLocation: "[dbo].[provider]",
          attributes: [{ sourceName: "provider_id", targetName: "provider_key" }],
        }),
      ]),
    );
  });
});
