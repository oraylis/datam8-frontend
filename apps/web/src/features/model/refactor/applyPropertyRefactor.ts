import type { PropertyRefactorPayload } from "@datam8/types";
import type { BaseEntity, FolderEntity, ModelEntity } from "../model-types";
import { detectBaseType } from "../model-utils";
import type { SupportedBaseScopeTarget } from "./propertyRefactorScopes";

type RefactorRules = {
  propertyRenames: Map<string, string>;
  deletedProperties: Set<string>;
  valueRenames: Map<string, string>;
  deletedValues: Set<string>;
  valueMoves: Map<string, { property: string; value: string }>;
};

export type PropertyRefactorApplyResult<T> = {
  updatedEntities: T[];
  changeCount: number;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function buildRules(payload: PropertyRefactorPayload): RefactorRules {
  const propertyRenames = new Map<string, string>();
  for (const item of payload.propertyRenames || []) {
    const oldName = normalizeString(item?.oldName);
    const newName = normalizeString(item?.newName);
    if (oldName && newName && oldName !== newName) {
      propertyRenames.set(oldName, newName);
    }
  }

  const deletedProperties = new Set<string>();
  for (const item of payload.deletedProperties || []) {
    const key = normalizeString(item);
    if (key) deletedProperties.add(key);
  }

  const valueRenames = new Map<string, string>();
  for (const item of payload.valueRenames || []) {
    const property = normalizeString(item?.property);
    const oldValue = normalizeString(item?.oldValue);
    const newValue = normalizeString(item?.newValue);
    if (property && oldValue && newValue && oldValue !== newValue) {
      valueRenames.set(`${property}\u0000${oldValue}`, newValue);
    }
  }

  const deletedValues = new Set<string>();
  for (const item of payload.deletedValues || []) {
    const property = normalizeString(item?.property);
    const value = normalizeString(item?.value);
    if (property && value) {
      deletedValues.add(`${property}\u0000${value}`);
    }
  }

  const valueMoves = new Map<string, { property: string; value: string }>();
  for (const item of payload.valueMoves || []) {
    const oldProperty = normalizeString(item?.oldProperty);
    const oldValue = normalizeString(item?.oldValue);
    const newProperty = normalizeString(item?.newProperty);
    const newValue = normalizeString(item?.newValue);
    if (oldProperty && oldValue && newProperty && newValue) {
      valueMoves.set(`${oldProperty}\u0000${oldValue}`, { property: newProperty, value: newValue });
    }
  }

  return { propertyRenames, deletedProperties, valueRenames, deletedValues, valueMoves };
}

function applyPropertyAssignments(value: unknown, rules: RefactorRules): [unknown, number] {
  if (!Array.isArray(value)) return [value, 0];
  let changes = 0;
  const next: Record<string, unknown>[] = [];

  value.forEach((entry) => {
    const row = asRecord(entry);
    if (!row) {
      next.push(entry as any);
      return;
    }
    const out = { ...row };
    let removed = false;

    const originalProperty = normalizeString(out.property);
    const originalValue = normalizeString(out.value);
    if (!originalProperty || !originalValue) {
      next.push(out);
      return;
    }

    const moveKey = `${originalProperty}\u0000${originalValue}`;
    const movedValue = rules.valueMoves.get(moveKey);
    if (movedValue) {
      if (movedValue.property !== originalProperty) {
        out.property = movedValue.property;
        changes += 1;
      }
      if (movedValue.value !== originalValue) {
        out.value = movedValue.value;
        changes += 1;
      }
    }

    const propertyAfterMove = normalizeString(out.property);
    if (!propertyAfterMove || rules.deletedProperties.has(propertyAfterMove)) {
      removed = true;
    } else {
      const renamedProperty = rules.propertyRenames.get(propertyAfterMove);
      if (renamedProperty) {
        out.property = renamedProperty;
        changes += 1;
      }

      const effectiveProperty = normalizeString(out.property);
      const valueAfterMove = normalizeString(out.value);
      if (effectiveProperty && valueAfterMove) {
        const valueKey = `${effectiveProperty}\u0000${valueAfterMove}`;
        if (rules.deletedValues.has(valueKey)) {
          removed = true;
        } else {
          const renamedValue = rules.valueRenames.get(valueKey);
          if (renamedValue) {
            out.value = renamedValue;
            changes += 1;
          }
        }
      }
    }

    if (removed) {
      changes += 1;
      return;
    }
    next.push(out);
  });

  if (changes === 0) return [value, 0];
  return [next, changes];
}

function updateRecordPropertyAssignments(
  input: Record<string, unknown>,
  key: string,
  rules: RefactorRules,
): [Record<string, unknown>, number] {
  const [nextList, changes] = applyPropertyAssignments(input[key], rules);
  if (changes === 0) return [input, 0];
  return [{ ...input, [key]: nextList }, changes];
}

function applyModelEntityContentRefactor(content: Record<string, unknown>, rules: RefactorRules): [Record<string, unknown>, number] {
  let changes = 0;
  let next = content;

  const applyTopLevel = (key: string) => {
    const [updated, keyChanges] = updateRecordPropertyAssignments(next, key, rules);
    if (keyChanges > 0) {
      next = updated;
      changes += keyChanges;
    }
  };

  applyTopLevel("properties");

  const attributes = Array.isArray(next.attributes) ? next.attributes : [];
  if (attributes.length > 0) {
    const nextAttributes = attributes.map((attribute) => {
      const row = asRecord(attribute);
      if (!row) return attribute;
      const [updated, attributeChanges] = updateRecordPropertyAssignments(row, "properties", rules);
      changes += attributeChanges;
      return updated;
    });
    if (changes > 0) next = { ...next, attributes: nextAttributes };
  }

  const sources = Array.isArray(next.sources) ? next.sources : [];
  if (sources.length > 0) {
    const nextSources = sources.map((source) => {
      const row = asRecord(source);
      if (!row) return source;
      let sourceChanges = 0;
      let nextSource = row;
      const [updatedSource, sourcePropChanges] = updateRecordPropertyAssignments(nextSource, "properties", rules);
      if (sourcePropChanges > 0) {
        nextSource = updatedSource;
        sourceChanges += sourcePropChanges;
      }
      const mappings = Array.isArray(nextSource.mapping) ? nextSource.mapping : [];
      if (mappings.length > 0) {
        const nextMappings = mappings.map((mapping) => {
          const mappingRow = asRecord(mapping);
          if (!mappingRow) return mapping;
          const [updatedMapping, mappingChanges] = updateRecordPropertyAssignments(mappingRow, "properties", rules);
          sourceChanges += mappingChanges;
          return updatedMapping;
        });
        if (sourceChanges > 0) {
          nextSource = { ...nextSource, mapping: nextMappings };
        }
      }
      changes += sourceChanges;
      return nextSource;
    });
    if (changes > 0) next = { ...next, sources: nextSources };
  }

  const transformations = Array.isArray(next.transformations) ? next.transformations : [];
  if (transformations.length > 0) {
    const nextTransformations = transformations.map((transform) => {
      const row = asRecord(transform);
      if (!row) return transform;
      const [updated, transformChanges] = updateRecordPropertyAssignments(row, "properties", rules);
      changes += transformChanges;
      return updated;
    });
    if (changes > 0) next = { ...next, transformations: nextTransformations };
  }

  return [next, changes];
}

export function applyPropertyRefactorToModelEntities(
  modelEntities: ModelEntity[],
  payload: PropertyRefactorPayload,
): PropertyRefactorApplyResult<ModelEntity> {
  const rules = buildRules(payload);
  const updatedEntities: ModelEntity[] = [];
  let changeCount = 0;

  modelEntities.forEach((entity) => {
    const [nextContent, changes] = applyModelEntityContentRefactor(entity.content || {}, rules);
    if (changes <= 0) return;
    updatedEntities.push({ ...entity, content: nextContent });
    changeCount += changes;
  });

  return { updatedEntities, changeCount };
}

function getFolderMetaContainer(content: Record<string, unknown>): [Record<string, unknown> | null, "direct" | "nested"] {
  if (typeof content.name === "string" || Array.isArray(content.properties)) return [content, "direct"];
  if (Array.isArray(content.folders) && content.folders.length > 0) {
    const first = asRecord(content.folders[0]);
    if (first) return [first, "nested"];
  }
  return [null, "direct"];
}

export function applyPropertyRefactorToFolderEntities(
  folderEntities: FolderEntity[],
  payload: PropertyRefactorPayload,
): PropertyRefactorApplyResult<FolderEntity> {
  const rules = buildRules(payload);
  const updatedEntities: FolderEntity[] = [];
  let changeCount = 0;

  folderEntities.forEach((entry) => {
    const content = asRecord(entry.content) || {};
    const [meta, kind] = getFolderMetaContainer(content);
    if (!meta) return;

    const [updatedMeta, changes] = updateRecordPropertyAssignments(meta, "properties", rules);
    if (changes <= 0) return;

    const nextContent =
      kind === "direct"
        ? { ...content, ...updatedMeta }
        : {
            ...content,
            folders: [updatedMeta, ...(Array.isArray(content.folders) ? content.folders.slice(1) : [])],
          };

    updatedEntities.push({ ...entry, content: nextContent as any });
    changeCount += changes;
  });

  return { updatedEntities, changeCount };
}

function applyBaseListProperties(
  content: Record<string, unknown>,
  listKey: string,
  rules: RefactorRules,
): [Record<string, unknown>, number] {
  const list = Array.isArray(content[listKey]) ? (content[listKey] as unknown[]) : [];
  if (list.length === 0) return [content, 0];
  let changes = 0;
  const nextList = list.map((item) => {
    const row = asRecord(item);
    if (!row) return item;
    const [updated, rowChanges] = updateRecordPropertyAssignments(row, "properties", rules);
    changes += rowChanges;
    return updated;
  });
  if (changes === 0) return [content, 0];
  return [{ ...content, [listKey]: nextList }, changes];
}

function singularizeBaseType(value: string): string {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("ies")) return `${trimmed.slice(0, -3)}y`;
  if (trimmed.endsWith("s")) return trimmed.slice(0, -1);
  return trimmed;
}

function applyDataModuleProperties(
  content: Record<string, unknown>,
  rules: RefactorRules,
): [Record<string, unknown>, number] {
  const products = Array.isArray(content.dataProducts) ? content.dataProducts : [];
  if (products.length === 0) return [content, 0];
  let changes = 0;
  const nextProducts = products.map((item) => {
    const row = asRecord(item);
    if (!row) return item;
    const modules = Array.isArray(row.dataModules) ? row.dataModules : [];
    if (modules.length === 0) return item;
    const nextModules = modules.map((moduleRow) => {
      const moduleObj = asRecord(moduleRow);
      if (!moduleObj) return moduleRow;
      const [updated, moduleChanges] = updateRecordPropertyAssignments(moduleObj, "properties", rules);
      changes += moduleChanges;
      return updated;
    });
    return { ...row, dataModules: nextModules };
  });
  if (changes === 0) return [content, 0];
  return [{ ...content, dataProducts: nextProducts }, changes];
}

function applyPropertyValueRows(
  content: Record<string, unknown>,
  rules: RefactorRules,
): [Record<string, unknown>, number] {
  const list = Array.isArray(content.propertyValues) ? content.propertyValues : [];
  if (list.length === 0) return [content, 0];

  let changes = 0;
  const nextRows: Record<string, unknown>[] = [];

  list.forEach((item) => {
    const row = asRecord(item);
    if (!row) {
      nextRows.push(item as any);
      return;
    }

    const nextRow = { ...row };
    const originalProperty = normalizeString(nextRow.property);
    const originalValue = normalizeString(nextRow.name);
    if (!originalProperty || !originalValue) {
      nextRows.push(nextRow);
      return;
    }

    let removed = false;

    const moveRule = rules.valueMoves.get(`${originalProperty}\u0000${originalValue}`);
    if (moveRule) {
      if (moveRule.property !== originalProperty) {
        nextRow.property = moveRule.property;
        changes += 1;
      }
      if (moveRule.value !== originalValue) {
        nextRow.name = moveRule.value;
        changes += 1;
      }
    }

    const propertyAfterMove = normalizeString(nextRow.property);
    if (!propertyAfterMove || rules.deletedProperties.has(propertyAfterMove)) {
      removed = true;
    } else {
      const renamedProperty = rules.propertyRenames.get(propertyAfterMove);
      if (renamedProperty) {
        nextRow.property = renamedProperty;
        changes += 1;
      }
    }

    const effectiveProperty = normalizeString(nextRow.property);
    const effectiveValue = normalizeString(nextRow.name);
    if (!removed && effectiveProperty && effectiveValue) {
      const valueKey = `${effectiveProperty}\u0000${effectiveValue}`;
      if (rules.deletedValues.has(valueKey)) {
        removed = true;
      } else {
        const renamedValue = rules.valueRenames.get(valueKey);
        if (renamedValue) {
          nextRow.name = renamedValue;
          changes += 1;
        }
      }
    }

    if (!removed) {
      const [withNestedUpdates, nestedChanges] = updateRecordPropertyAssignments(nextRow, "properties", rules);
      if (nestedChanges > 0) {
        changes += nestedChanges;
      }
      nextRows.push(withNestedUpdates);
      return;
    }

    if (removed) {
      changes += 1;
      return;
    }
  });

  const dedupedRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  nextRows.forEach((row) => {
    const key = `${normalizeString(row.property)}\u0000${normalizeString(row.name)}`;
    if (seen.has(key)) {
      changes += 1;
      return;
    }
    seen.add(key);
    dedupedRows.push(row);
  });

  if (changes === 0) return [content, 0];
  return [{ ...content, propertyValues: dedupedRows }, changes];
}

export function applyPropertyRefactorToBaseEntities(
  baseEntities: BaseEntity[],
  payload: PropertyRefactorPayload,
  baseTargets: SupportedBaseScopeTarget[],
): PropertyRefactorApplyResult<BaseEntity> {
  if (baseTargets.length === 0) return { updatedEntities: [], changeCount: 0 };
  const targetSet = new Set(baseTargets.map((target) => normalizeString(target).toLowerCase()));
  const rules = buildRules(payload);
  const updatedEntities: BaseEntity[] = [];
  let changeCount = 0;

  baseEntities.forEach((entry) => {
    const content = asRecord(entry.content) || {};
    const type = detectBaseType(content, entry.relPath).type;
    const singularType = singularizeBaseType(type);
    let next = content;
    let changes = 0;

    if (type === "propertyValues" && targetSet.has("propertyvalues")) {
      const [updated, c] = applyPropertyValueRows(next, rules);
      next = updated;
      changes += c;
    }

    if (singularType && targetSet.has(normalizeString(singularType).toLowerCase())) {
      const [updated, c] = applyBaseListProperties(next, type, rules);
      next = updated;
      changes += c;
    }
    if (type === "dataProducts" && targetSet.has("datamodule")) {
      const [updated, c] = applyDataModuleProperties(next, rules);
      next = updated;
      changes += c;
    }

    if (changes <= 0) return;
    updatedEntities.push({ ...entry, content: next });
    changeCount += changes;
  });

  return { updatedEntities, changeCount };
}

export function summarizePropertyRefactorImpact(result: { updatedEntities: unknown[]; changeCount: number }): {
  entityCount: number;
  changeCount: number;
} {
  return {
    entityCount: result.updatedEntities.length,
    changeCount: result.changeCount,
  };
}
