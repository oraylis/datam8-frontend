import type { BaseEntity, BaseProperty, BasePropertyValue, PropertyOption } from "./model-types";
import { detectBaseType } from "./model-utils";

const normalizeKey = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

export function buildPropertyOptionsFromBaseEntities(baseEntities: BaseEntity[]): PropertyOption[] {
  const propertiesEntry = baseEntities.find((entry) => detectBaseType(entry.content, entry.relPath).type === "properties");
  const propertyValuesEntry =
    baseEntities.find((entry) => detectBaseType(entry.content, entry.relPath).type === "propertyValues") ||
    baseEntities.find((entry) => normalizeKey(entry.name).includes("propertyvalues"));

  const propertyNames = (propertiesEntry?.content?.properties || [])
    .map((item: BaseProperty) => (typeof item?.name === "string" ? item.name.trim() : ""))
    .filter(Boolean);
  const uniquePropertyNames = Array.from(new Set(propertyNames));

  const valuesByProperty: Record<string, string[]> = {};
  const pushValue = (item: BasePropertyValue) => {
    const property = typeof item?.property === "string" ? item.property.trim() : "";
    const value = typeof item?.name === "string" ? item.name.trim() : "";
    if (!property || !value) return;
    if (!valuesByProperty[property]) valuesByProperty[property] = [];
    if (!valuesByProperty[property].includes(value)) valuesByProperty[property].push(value);
  };

  (propertyValuesEntry?.content?.propertyValues || []).forEach(pushValue);
  // Legacy fallback while older solutions may still have inline values in Properties.json.
  (propertiesEntry?.content?.propertyValues || []).forEach(pushValue);

  return uniquePropertyNames.map((name) => ({ name, values: valuesByProperty[name] || [] }));
}
