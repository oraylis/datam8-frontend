import type { PropertyRefactorPayload } from "@datam8/types";
import type { ModelEntity } from "../model-types";

const DELETE = Symbol("delete");

type RefactorRules = {
  propertyRenames: Map<string, string>;
  deletedProperties: Set<string>;
  valueRenames: Map<string, string>;
  deletedValues: Set<string>;
};

export type PropertyRefactorApplyResult = {
  updatedEntities: ModelEntity[];
  changeCount: number;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

  return { propertyRenames, deletedProperties, valueRenames, deletedValues };
}

function applyNode(node: unknown, rules: RefactorRules): [unknown, number] {
  if (Array.isArray(node)) {
    let changes = 0;
    const next: unknown[] = [];
    for (const entry of node) {
      const [updated, entryChanges] = applyNode(entry, rules);
      changes += entryChanges;
      if (updated !== DELETE) {
        next.push(updated);
      } else {
        changes += 1;
      }
    }
    if (changes === 0) return [node, 0];
    return [next, changes];
  }

  if (!node || typeof node !== "object") return [node, 0];

  const obj = node as Record<string, unknown>;
  let changes = 0;
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const [updated, childChanges] = applyNode(value, rules);
    changes += childChanges;
    if (updated !== DELETE) {
      next[key] = updated;
    } else {
      changes += 1;
    }
  }

  const rawProperty = normalizeString(next.property);
  if (rawProperty) {
    if (rules.deletedProperties.has(rawProperty)) {
      return [DELETE, changes + 1];
    }

    const renamedProperty = rules.propertyRenames.get(rawProperty);
    const effectiveProperty = renamedProperty || rawProperty;
    if (renamedProperty) {
      next.property = renamedProperty;
      changes += 1;
    }

    const rawValue = normalizeString(next.value);
    if (rawValue) {
      const deleteKey = `${effectiveProperty}\u0000${rawValue}`;
      if (rules.deletedValues.has(deleteKey)) {
        return [DELETE, changes + 1];
      }
      const renamedValue = rules.valueRenames.get(deleteKey);
      if (renamedValue) {
        next.value = renamedValue;
        changes += 1;
      }
    }
  }

  if (changes === 0) return [node, 0];
  return [next, changes];
}

export function applyPropertyRefactorToModelEntities(
  modelEntities: ModelEntity[],
  payload: PropertyRefactorPayload,
): PropertyRefactorApplyResult {
  const rules = buildRules(payload);
  const updatedEntities: ModelEntity[] = [];
  let changeCount = 0;

  for (const entity of modelEntities) {
    const [nextContent, changes] = applyNode(entity.content, rules);
    if (changes === 0 || nextContent === DELETE) continue;
    updatedEntities.push({ ...entity, content: nextContent as Record<string, unknown> });
    changeCount += changes;
  }

  return { updatedEntities, changeCount };
}

export function summarizePropertyRefactorImpact(result: PropertyRefactorApplyResult): { entityCount: number; changeCount: number } {
  return {
    entityCount: result.updatedEntities.length,
    changeCount: result.changeCount,
  };
}
