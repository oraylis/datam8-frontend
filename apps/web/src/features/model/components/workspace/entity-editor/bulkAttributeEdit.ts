import type { EntityAttribute } from "./types";

export type BulkAttributeEditField =
  | "dataType"
  | "nullable"
  | "isBusinessKey"
  | "history"
  | "attributeType"
  | "expressionLanguage"
  | "unit"
  | "property";

export type BulkAttributeEditRule = {
  id: string;
  field: BulkAttributeEditField;
  value?: string | boolean;
  propertyName?: string;
};

export const BULK_ATTRIBUTE_EDIT_FIELD_LABELS: Record<BulkAttributeEditField, string> = {
  dataType: "Data Type",
  nullable: "Nullable",
  isBusinessKey: "Business Key",
  history: "History",
  attributeType: "Attribute Type",
  expressionLanguage: "Expression Language",
  unit: "Unit",
  property: "Column Property",
};

const BOOLEAN_FIELDS = new Set<BulkAttributeEditField>(["nullable", "isBusinessKey"]);

export const isBulkAttributeEditBooleanField = (field: BulkAttributeEditField): boolean => BOOLEAN_FIELDS.has(field);

const getRuleDuplicateKey = (rule: BulkAttributeEditRule): string =>
  rule.field === "property" ? `${rule.field}:${(rule.propertyName || "").trim()}` : rule.field;

export const getDuplicateBulkAttributeEditFields = (rules: BulkAttributeEditRule[]): Set<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  rules.forEach((rule) => {
    const key = getRuleDuplicateKey(rule);
    if (seen.has(key)) {
      duplicates.add(key);
      return;
    }
    seen.add(key);
  });
  return duplicates;
};

export const getAttributeIdsInRange = (
  attributes: EntityAttribute[],
  anchorId: string | null,
  targetId: string | null,
): Set<string> => {
  if (!anchorId || !targetId) return new Set<string>();
  const ids = attributes.map((attr) => attr.__uiId).filter((id): id is string => typeof id === "string" && id.length > 0);
  const start = ids.indexOf(anchorId);
  const end = ids.indexOf(targetId);
  if (start === -1 || end === -1) return new Set<string>();
  const [from, to] = start < end ? [start, end] : [end, start];
  return new Set(ids.slice(from, to + 1));
};

const withModifiedFlag = (previous: EntityAttribute, next: EntityAttribute): EntityAttribute => {
  if (previous === next) return previous;
  if (next.__isNew) return next;
  if (next.__modified) return next;
  return { ...next, __modified: true };
};

const applyStringFieldRule = (
  attribute: EntityAttribute,
  key: "history" | "attributeType" | "expressionLanguage" | "unit",
  rule: BulkAttributeEditRule,
): EntityAttribute => {
  const nextValue = `${rule.value ?? ""}`;
  const currentValue = `${attribute[key] ?? ""}`;
  if (currentValue === nextValue) return attribute;
  return { ...attribute, [key]: nextValue };
};

const applyRuleToAttribute = (attribute: EntityAttribute, rule: BulkAttributeEditRule): EntityAttribute => {
  switch (rule.field) {
    case "dataType": {
      const nextType = `${rule.value ?? ""}`;
      const currentType = `${attribute.dataType?.type ?? ""}`;
      if (currentType === nextType) return attribute;
      return {
        ...attribute,
        dataType: {
          ...(attribute.dataType || {}),
          type: nextType,
        },
      };
    }
    case "nullable": {
      if (typeof rule.value !== "boolean") return attribute;
      const currentNullable = attribute.dataType?.nullable ?? true;
      if (currentNullable === rule.value) return attribute;
      return {
        ...attribute,
        dataType: {
          ...(attribute.dataType || {}),
          nullable: rule.value,
        },
      };
    }
    case "isBusinessKey": {
      if (typeof rule.value !== "boolean") return attribute;
      const currentValue = attribute.isBusinessKey ?? false;
      if (currentValue === rule.value) return attribute;
      return { ...attribute, isBusinessKey: rule.value };
    }
    case "history":
      return applyStringFieldRule(attribute, "history", rule);
    case "attributeType":
      return applyStringFieldRule(attribute, "attributeType", rule);
    case "expressionLanguage":
      return applyStringFieldRule(attribute, "expressionLanguage", rule);
    case "unit":
      return applyStringFieldRule(attribute, "unit", rule);
    case "property": {
      const propertyName = `${rule.propertyName ?? ""}`.trim();
      if (!propertyName) return attribute;
      const currentProperties = Array.isArray(attribute.properties) ? attribute.properties : [];
      const nextValue = `${rule.value ?? ""}`;
      if (!nextValue) {
        const filtered = currentProperties.filter((property) => `${property?.property ?? ""}` !== propertyName);
        if (filtered.length === currentProperties.length) return attribute;
        return { ...attribute, properties: filtered };
      }
      const existingIndex = currentProperties.findIndex((property) => `${property?.property ?? ""}` === propertyName);
      if (existingIndex === -1) {
        return {
          ...attribute,
          properties: [...currentProperties, { property: propertyName, value: nextValue }],
        };
      }
      if (`${currentProperties[existingIndex]?.value ?? ""}` === nextValue) return attribute;
      const nextProperties = currentProperties.slice();
      nextProperties[existingIndex] = { property: propertyName, value: nextValue };
      return { ...attribute, properties: nextProperties };
    }
    default:
      return attribute;
  }
};

export const applyBulkAttributeEditRules = (
  attributes: EntityAttribute[],
  selectedIds: Set<string>,
  rules: BulkAttributeEditRule[],
): EntityAttribute[] =>
  attributes.map((attribute) => {
    if (!attribute.__uiId || !selectedIds.has(attribute.__uiId)) return attribute;
    const nextAttribute = rules.reduce((current, rule) => applyRuleToAttribute(current, rule), attribute);
    return withModifiedFlag(attribute, nextAttribute);
  });
