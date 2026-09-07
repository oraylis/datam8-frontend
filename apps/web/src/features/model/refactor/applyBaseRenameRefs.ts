import type { BaseEntity, FolderEntity, ModelEntity } from "../model-types";
import { detectBaseType } from "../model-utils";

export type BaseNameRename = { oldName: string; newName: string };
export type DataModuleRename = BaseNameRename & { dataProduct: string };

type RenameResult<T> = { updatedEntities: T[]; changeCount: number };

const renameValue = (value: unknown, renames: Map<string, string>): [unknown, boolean] => {
  if (typeof value !== "string") return [value, false];
  const next = renames.get(value);
  return next ? [next, true] : [value, false];
};

export function applyBaseNameRenamesToModelEntities(
  entities: ModelEntity[],
  baseType: string,
  changes: BaseNameRename[],
): RenameResult<ModelEntity> {
  const renames = new Map(changes.map((change) => [change.oldName, change.newName]));
  if (renames.size === 0) return { updatedEntities: [], changeCount: 0 };
  const updatedEntities: ModelEntity[] = [];
  let changeCount = 0;

  for (const entity of entities) {
    const content = structuredClone(entity.content || {});
    let changed = false;
    const mark = (didChange: boolean) => {
      if (!didChange) return;
      changed = true;
      changeCount += 1;
    };

    if (baseType === "attributeTypes" || baseType === "dataTypes") {
      content.attributes = (content.attributes || []).map((attribute) => {
        const next = { ...attribute };
        if (baseType === "attributeTypes") {
          const [value, didChange] = renameValue(next.attributeType, renames);
          next.attributeType = value;
          mark(didChange);
        } else if (next.dataType && typeof next.dataType === "object") {
          const dataType = { ...(next.dataType as Record<string, unknown>) };
          const [value, didChange] = renameValue(dataType.type, renames);
          dataType.type = value;
          next.dataType = dataType;
          mark(didChange);
        }
        return next;
      });
    }

    if (baseType === "dataSources" || baseType === "dataTypes") {
      content.sources = (content.sources || []).map((source) => {
        const next = { ...source };
        if (baseType === "dataSources") {
          const [value, didChange] = renameValue(next.dataSource, renames);
          next.dataSource = value;
          mark(didChange);
        } else if (Array.isArray(next.mapping)) {
          next.mapping = next.mapping.map((mapping: Record<string, unknown>) => {
            if (!mapping.sourceDataType || typeof mapping.sourceDataType !== "object") return mapping;
            const sourceDataType = { ...(mapping.sourceDataType as Record<string, unknown>) };
            const [value, didChange] = renameValue(sourceDataType.type, renames);
            sourceDataType.type = value;
            mark(didChange);
            return { ...mapping, sourceDataType };
          });
        }
        return next;
      });
    }

    if (baseType === "dataSources" && Array.isArray(content.relationships)) {
      content.relationships = content.relationships.map((relationship) => {
        const next = { ...relationship };
        const [value, didChange] = renameValue(next.dataSource, renames);
        next.dataSource = value;
        mark(didChange);
        return next;
      });
    }

    if (changed) updatedEntities.push({ ...entity, content });
  }

  return { updatedEntities, changeCount };
}

export function applyBaseNameRenamesToBaseEntities(
  entities: BaseEntity[],
  baseType: string,
  changes: BaseNameRename[],
): RenameResult<BaseEntity> {
  if (baseType !== "dataSourceTypes") return { updatedEntities: [], changeCount: 0 };
  const renames = new Map(changes.map((change) => [change.oldName, change.newName]));
  const updatedEntities: BaseEntity[] = [];
  let changeCount = 0;

  for (const entity of entities) {
    if (detectBaseType(entity.content, entity.relPath).type !== "dataSources") continue;
    let changed = false;
    const dataSources = (entity.content.dataSources || []).map((dataSource) => {
      const next = { ...dataSource };
      for (const key of ["type", "dataSourceType"] as const) {
        const [value, didChange] = renameValue(next[key], renames);
        if (didChange) {
          next[key] = value as string;
          changed = true;
          changeCount += 1;
        }
      }
      return next;
    });
    if (changed) updatedEntities.push({ ...entity, content: { ...entity.content, dataSources } });
  }

  return { updatedEntities, changeCount };
}

export function applyBaseNameRenamesToFolderEntities(
  entities: FolderEntity[],
  baseType: string,
  changes: BaseNameRename[],
  moduleChanges: DataModuleRename[] = [],
): RenameResult<FolderEntity> {
  if (baseType !== "dataProducts" || (changes.length === 0 && moduleChanges.length === 0)) {
    return { updatedEntities: [], changeCount: 0 };
  }
  const productRenames = new Map(changes.map((change) => [change.oldName, change.newName]));
  const updatedEntities: FolderEntity[] = [];
  let changeCount = 0;

  for (const entity of entities) {
    const content = structuredClone(entity.content || {});
    const meta = Array.isArray(content.folders) && content.folders[0] ? content.folders[0] : content;
    const originalProduct = typeof meta.dataProduct === "string" ? meta.dataProduct : "";
    const originalModule = typeof meta.dataModule === "string" ? meta.dataModule : "";
    let changed = false;

    const productName = productRenames.get(originalProduct);
    if (productName) {
      meta.dataProduct = productName;
      changed = true;
      changeCount += 1;
    }
    const moduleRename = moduleChanges.find(
      (change) => change.dataProduct === originalProduct && change.oldName === originalModule,
    );
    if (moduleRename) {
      meta.dataModule = moduleRename.newName;
      changed = true;
      changeCount += 1;
    }

    if (changed) updatedEntities.push({ ...entity, content });
  }

  return { updatedEntities, changeCount };
}

export function diffDataModuleRenames(previousProducts: unknown[], nextProducts: unknown[]): DataModuleRename[] {
  if (previousProducts.length !== nextProducts.length) return [];
  const changes: DataModuleRename[] = [];
  for (let productIndex = 0; productIndex < previousProducts.length; productIndex += 1) {
    const previous = previousProducts[productIndex] as Record<string, unknown>;
    const next = nextProducts[productIndex] as Record<string, unknown>;
    const previousModules = Array.isArray(previous?.dataModules) ? previous.dataModules : [];
    const nextModules = Array.isArray(next?.dataModules) ? next.dataModules : [];
    if (previousModules.length !== nextModules.length) continue;
    for (let moduleIndex = 0; moduleIndex < previousModules.length; moduleIndex += 1) {
      const oldName = `${(previousModules[moduleIndex] as Record<string, unknown>)?.name || ""}`.trim();
      const newName = `${(nextModules[moduleIndex] as Record<string, unknown>)?.name || ""}`.trim();
      if (oldName && newName && oldName !== newName) {
        changes.push({ dataProduct: `${previous?.name || ""}`.trim(), oldName, newName });
      }
    }
  }
  return changes;
}
