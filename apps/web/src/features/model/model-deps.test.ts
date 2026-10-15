import { describe, expect, it } from "vitest";
import { findModelEntityDependents } from "./model-deps";
import type { ModelEntity } from "./model-types";

const entity = (name: string, id: number, relationships: any[] = []): ModelEntity => ({
  locator: `/core/${name}`,
  name,
  relPath: `Model/core/${name}.json`,
  content: {
    id,
    name,
    attributes: [],
    sources: [],
    relationships,
  },
});

describe("findModelEntityDependents relationships", () => {
  it("finds canonical internal relationship targets", () => {
    const customer = entity("Customer", 1);
    const order = entity("Order", 2, [
      { targetLocation: 1, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] },
    ]);

    const result = findModelEntityDependents(customer, [customer, order]);

    expect(result).toEqual([
      expect.objectContaining({
        dependentEntityName: "Order",
        field: "relationships[0].targetLocation",
        matchType: "id",
      }),
    ]);
  });

  it("ignores external relationship target locations", () => {
    const customer = entity("Customer", 1);
    const order = entity("Order", 2, [
      { dataSource: "crm", targetLocation: "1", attributes: [{ sourceName: "CustomerId", targetName: "Id" }] },
    ]);

    expect(findModelEntityDependents(customer, [customer, order])).toEqual([]);
  });
});
