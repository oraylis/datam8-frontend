export type PropertyValueGroupItem = {
  item: Record<string, unknown>;
  index: number;
};

export type PropertyValueGroup = {
  propertyKey: string;
  propertyLabel: string;
  items: PropertyValueGroupItem[];
};

const UNASSIGNED_PROPERTY_KEY = "__unassigned__";
const UNASSIGNED_PROPERTY_LABEL = "Unassigned property";

const asPropertyLabel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const buildPropertyValueGroups = (items: unknown[]): PropertyValueGroup[] => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const groups = new Map<string, PropertyValueGroup>();

  items.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const item = entry as Record<string, unknown>;
    const propertyLabel = asPropertyLabel(item.property) || UNASSIGNED_PROPERTY_LABEL;
    const propertyKey = asPropertyLabel(item.property)?.toLowerCase() || UNASSIGNED_PROPERTY_KEY;
    const current =
      groups.get(propertyKey) ||
      {
        propertyKey,
        propertyLabel,
        items: [],
      };
    current.items.push({ item, index });
    groups.set(propertyKey, current);
  });

  return Array.from(groups.values());
};
