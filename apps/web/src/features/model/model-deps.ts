import { ModelEntity } from "./model-types";

export type EntityDependencyKind = "required-single" | "optional-single" | "collection";

export type EntityDependency = {
  dependentEntityId: string; // locator
  dependentEntityName: string;
  dependentRelPath: string;
  path: string; // dependent relPath
  kind: EntityDependencyKind;
  field: string;
  matchType: "locator" | "id";
};

export function findModelEntityDependents(
  targetEntity: ModelEntity,
  allEntities: ModelEntity[]
): EntityDependency[] {
  const deps: EntityDependency[] = [];
  const targetLocator = targetEntity.locator;
  const targetId = targetEntity.content?.id;

  // Normalize targetLocator
  const normTargetLocator = targetLocator.startsWith("/") ? targetLocator : `/${targetLocator}`;

  for (const entity of allEntities) {
    if (entity.locator === targetLocator) continue;

    const content = entity.content || {};

    // 1. Check sourceEntityId (Path or ID)
    if (content.sourceEntityId) {
       const val = content.sourceEntityId;
       // Check locator match
       const normVal = typeof val === "string" && val.startsWith("/") ? val : `/${val}`;
       if (normVal === normTargetLocator) {
           deps.push({
             dependentEntityId: entity.locator,
             dependentEntityName: entity.name,
             dependentRelPath: entity.relPath,
             path: entity.relPath,
             kind: "optional-single",
             field: "sourceEntityId",
             matchType: "locator"
           });
       }
       // Check ID match
       if (targetId !== undefined && val === targetId) {
           deps.push({
             dependentEntityId: entity.locator,
             dependentEntityName: entity.name,
             dependentRelPath: entity.relPath,
             path: entity.relPath,
             kind: "optional-single",
             field: "sourceEntityId",
             matchType: "id"
           });
       }
    }

    // 2. Check sourceEntityIds (collection)
    if (Array.isArray(content.sourceEntityIds)) {
       const hasLocator = content.sourceEntityIds.some((id: any) => {
           if (typeof id === "string") {
               return (id.startsWith("/") ? id : `/${id}`) === normTargetLocator;
           }
           return false;
       });
       const hasId = targetId !== undefined && content.sourceEntityIds.includes(targetId);

       if (hasLocator) {
           deps.push({
             dependentEntityId: entity.locator,
             dependentEntityName: entity.name,
             dependentRelPath: entity.relPath,
             path: entity.relPath,
             kind: "collection",
             field: "sourceEntityIds",
             matchType: "locator"
           });
       } else if (hasId) {
           deps.push({
             dependentEntityId: entity.locator,
             dependentEntityName: entity.name,
             dependentRelPath: entity.relPath,
             path: entity.relPath,
             kind: "collection",
             field: "sourceEntityIds",
             matchType: "id"
           });
       }
    }

    // 3. Check relationships (internal target references)
    if (Array.isArray(content.relationships)) {
      content.relationships.forEach((rel: any, idx: number) => {
         // Check by ID
         const isExternalRelationship = !!rel?.dataSource;
         const internalTargetId = rel.targetModelEntityId ?? (!isExternalRelationship ? rel.targetLocation : undefined);
         if (targetId !== undefined && internalTargetId === targetId) {
             deps.push({
                dependentEntityId: entity.locator,
                dependentEntityName: entity.name,
                dependentRelPath: entity.relPath,
                path: entity.relPath,
                kind: "collection",
                field: `relationships[${idx}].${rel.targetModelEntityId !== undefined ? "targetModelEntityId" : "targetLocation"}`,
                matchType: "id"
             });
         }
         // Check by Locator (if applicable, legacy?)
         if (rel.targetEntityId) {
             const norm = rel.targetEntityId.startsWith("/") ? rel.targetEntityId : `/${rel.targetEntityId}`;
             if (norm === normTargetLocator) {
                 deps.push({
                    dependentEntityId: entity.locator,
                    dependentEntityName: entity.name,
                    dependentRelPath: entity.relPath,
                    path: entity.relPath,
                    kind: "collection",
                    field: `relationships[${idx}].targetEntityId`,
                    matchType: "locator"
                 });
             }
         }
         // Check sourceEntityId in relationship? (Usually referencing THIS entity as source?)
         if (rel.sourceEntityId) {
             const norm = rel.sourceEntityId.startsWith("/") ? rel.sourceEntityId : `/${rel.sourceEntityId}`;
             if (norm === normTargetLocator) {
                 deps.push({
                    dependentEntityId: entity.locator,
                    dependentEntityName: entity.name,
                    dependentRelPath: entity.relPath,
                    path: entity.relPath,
                    kind: "collection",
                    field: `relationships[${idx}].sourceEntityId`,
                    matchType: "locator"
                 });
             }
         }
         // Check sourceModelEntityId?
         if (targetId !== undefined && rel.sourceModelEntityId === targetId) {
             deps.push({
                dependentEntityId: entity.locator,
                dependentEntityName: entity.name,
                dependentRelPath: entity.relPath,
                path: entity.relPath,
                kind: "collection",
                field: `relationships[${idx}].sourceModelEntityId`,
                matchType: "id"
             });
         }
      });
    }
    
    // 4. Check sources array (sourceLocation)
    if (Array.isArray(content.sources)) {
        content.sources.forEach((src: any, idx: number) => {
            const isInternal = src.type === "internal" || src.type === undefined;
            if (targetId !== undefined && isInternal && src.sourceLocation === targetId) {
                 deps.push({
                    dependentEntityId: entity.locator,
                    dependentEntityName: entity.name,
                    dependentRelPath: entity.relPath,
                    path: entity.relPath,
                    kind: "collection", // sources is a collection
                    field: `sources[${idx}].sourceLocation`,
                    matchType: "id"
                 });
            }
        });
    }
  }
  return deps;
}
