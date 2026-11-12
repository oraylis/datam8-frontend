import type { ModelEntity } from "../../model-types";

export function lineageEntity(id: number, name: string, folder = "Core/Sales"): ModelEntity {
  return { locator: `/Model/${folder}/${name}`, relPath: `Model/${folder}/${name}.json`, name, content: { id, name, attributes: [] } };
}

export function createMixedLineage(): ModelEntity[] {
  const entities = [
    lineageEntity(1, "Address", "Core/MasterData"), lineageEntity(2, "Customer", "Core/MasterData"),
    lineageEntity(3, "CustomerAddress", "Core/MasterData"), lineageEntity(4, "DimCustomer", "Curated/MasterData"),
    lineageEntity(5, "Customer", "Consumer/MasterData"), lineageEntity(6, "FactSalesOrder", "Curated/Sales"),
    lineageEntity(7, "DimDate", "Curated/Calendar"), lineageEntity(8, "SalesOrder", "Consumer/Sales"),
  ];
  entities[3].content.sources = [1, 2, 3].map((sourceLocation) => ({ sourceLocation }));
  entities[4].content.sources = [{ sourceLocation: 4 }];
  entities[5].content.sources = [{ sourceLocation: 4 }];
  entities[7].content.sources = [{ sourceLocation: 6 }];
  entities[4].content.relationships = [{ targetLocation: 4, attributes: [{ sourceName: "CustomerId", targetName: "Id" }] }];
  entities[5].content.relationships = [{ targetLocation: 4 }, { targetLocation: 7 }];
  entities[7].content.relationships = [{ targetLocation: 6 }];
  return entities;
}

export function createLargeLineage(count: number): ModelEntity[] {
  return Array.from({ length: count }, (_, index) => {
    const entity = lineageEntity(index, `Entity${index}`, `Core/Module${Math.floor(index / 100)}`);
    entity.content.sources = index > 0 ? [{ sourceLocation: index - 1 }] : [];
    entity.content.relationships = index > 10 ? [{ targetLocation: index - 10 }] : [];
    return entity;
  });
}

export function createDenseLineage(count = 80): ModelEntity[] {
  return Array.from({ length: count }, (_, index) => {
    const entity = lineageEntity(index, `Entity${index}`, `Core/Module${Math.floor(index / 10)}`);
    entity.content.sources = Array.from({ length: index }, (_value, sourceLocation) => ({ sourceLocation }));
    entity.content.relationships = Array.from({ length: index }, (_value, targetLocation) => ({ targetLocation }));
    return entity;
  });
}
