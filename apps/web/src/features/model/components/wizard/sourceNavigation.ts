import type { PropertyAssignment } from "@datam8/types";
import type { SourceOverride, TableMetadata } from "../../model-types";
import { toSourceOverride } from "./sourceOverride";

export type SourceLocationItem = {
  name: string;
  sourceLocation: string;
  type: string;
  schema?: string;
  description?: string;
  properties?: PropertyAssignment[];
  sourceOverride?: SourceOverride;
};

export function normalizeLocationItem(item: Record<string, unknown>): SourceLocationItem | null {
  if (typeof item.name !== "string" || !item.name.trim() ||
      typeof item.sourceLocation !== "string" || !item.sourceLocation.trim()) return null;
  return {
    name: item.name,
    sourceLocation: item.sourceLocation,
    type: typeof item.type === "string" ? item.type : "OBJECT",
    schema: typeof item.schema === "string" ? item.schema : undefined,
    description: typeof item.description === "string" ? item.description : undefined,
    properties: propertyAssignments(item.properties),
    sourceOverride: toSourceOverride(item.sourceOverride),
  };
}

export function isBrowsableLocation(item: Pick<SourceLocationItem, "type">): boolean {
  return ["SCHEMA", "CONTAINER", "DIRECTORY"].includes(item.type.toUpperCase());
}

export function normalizeLocations(payload: unknown): SourceLocationItem[] {
  const items = (payload as { items?: unknown })?.items;
  if (!Array.isArray(items)) throw new Error("The backend did not provide source locations.");
  return items.map((item) => {
    const normalized = normalizeLocationItem(item || {});
    if (!normalized) throw new Error("Source locations require a name and sourceLocation.");
    return normalized;
  });
}

export async function collectSelectableLocations(
  load: (location?: string) => Promise<SourceLocationItem[]>,
  onProgress: (items: SourceLocationItem[]) => void = () => {},
): Promise<SourceLocationItem[]> {
  const pending: Array<string | undefined> = [undefined];
  const visited = new Set<string>();
  const selectable = new Map<string, SourceLocationItem>();
  while (pending.length) {
    const results = await Promise.all(pending.splice(0, 4).map(load));
    for (const items of results) {
      for (const item of items) {
        if (isBrowsableLocation(item)) {
          if (!visited.has(item.sourceLocation)) {
            visited.add(item.sourceLocation);
            pending.push(item.sourceLocation);
          }
        } else {
          selectable.set(item.sourceLocation, item);
        }
      }
    }
    onProgress([...selectable.values()]);
  }
  return [...selectable.values()];
}

function propertyAssignments(input: unknown): PropertyAssignment[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.filter((item) => typeof item?.property === "string" && item.property.trim());
}

export function normalizeSourceMetadata(
  payload: Record<string, any>,
  location: string,
  listed?: SourceLocationItem,
): TableMetadata {
  const object = payload.object || {};
  return {
    name: typeof object.name === "string" ? object.name : listed?.name || location,
    schema: typeof object.schema === "string" ? object.schema : listed?.schema || "",
    type: typeof object.type === "string" ? object.type : listed?.type || "OBJECT",
    sourceLocation: typeof payload.sourceLocation === "string" ? payload.sourceLocation : location,
    description: object.description ?? payload.description ?? listed?.description,
    properties: propertyAssignments(object.properties ?? payload.properties) ?? listed?.properties,
    sourceOverride: toSourceOverride(payload.sourceOverride ?? object.sourceOverride) ?? listed?.sourceOverride,
    columns: (Array.isArray(payload.items) ? payload.items : []).map((column: any) => ({
      name: `${column?.name || ""}`,
      ordinal: Number(column?.ordinal || 0),
      dataType: `${column?.dataType || ""}`,
      maxLength: typeof column?.maxLength === "number" ? column.maxLength : null,
      numericPrecision: typeof column?.numericPrecision === "number" ? column.numericPrecision : null,
      numericScale: typeof column?.numbericScale === "number" ? column.numbericScale : null,
      isNullable: Boolean(column?.isNullable),
      isPrimaryKey: Boolean(column?.isPrimaryKey),
      description: typeof column?.description === "string" ? column.description : undefined,
      properties: propertyAssignments(column?.properties),
      relationships: Array.isArray(column?.relationships) ? column.relationships : undefined,
    })),
  };
}
