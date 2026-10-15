type BaseItem = Record<string, unknown> | null | undefined;

const nonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nonEmptyId = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = `${value}`.trim();
  return normalized.length > 0 ? normalized : null;
};

const getStructuredSelectionKey = (item: BaseItem): string | null => {
  const property = nonEmptyString(item?.property);
  const name = nonEmptyString(item?.name);
  if (property && name) return `property:${property}::name:${name}`;
  if (name) return `name:${name}`;
  const id = nonEmptyId(item?.id);
  if (id) return `id:${id}`;
  return null;
};

export const getBaseItemSelectionKey = (item: BaseItem, index: number): string => {
  const structured = getStructuredSelectionKey(item) || "row";
  return `v2:${structured}::idx:${index}`;
};

export const getBaseItemLegacySelectionKey = (item: BaseItem): string => {
  const name = nonEmptyString(item?.name);
  if (name) return name;
  const id = nonEmptyId(item?.id);
  if (id) return id;
  return "Unnamed";
};

export const isBaseItemSelected = (item: BaseItem, index: number, selectedKey: string | null): boolean => {
  if (!selectedKey) return false;
  return selectedKey === getBaseItemSelectionKey(item, index);
};

export const findBaseItemIndex = (items: BaseItem[], selectedKey: string | null): number => {
  if (!Array.isArray(items) || items.length === 0 || !selectedKey) return -1;
  const idxMatch = selectedKey.match(/::idx:(\d+)$/);
  if (idxMatch) {
    const idx = Number(idxMatch[1]);
    if (Number.isInteger(idx) && idx >= 0 && idx < items.length) {
      if (selectedKey === getBaseItemSelectionKey(items[idx], idx)) return idx;
    }
  }
  return items.findIndex((item, idx) => selectedKey === getBaseItemSelectionKey(item, idx));
};
