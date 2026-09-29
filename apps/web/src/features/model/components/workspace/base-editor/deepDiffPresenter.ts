export type DeepDiffGroup = "attributes" | "entityProperties" | "sources" | "mappings" | "entity";

export type DeepDiffEntry = {
  id: string;
  category: string;
  operation: "added" | "removed" | "changed";
  path: string;
  displayPath: string;
  group: DeepDiffGroup;
  before?: unknown;
  after?: unknown;
  beforeType?: string;
  afterType?: string;
};

export type DeepDiffColumnGroup = {
  key: string;
  label: string;
  changes: DeepDiffEntry[];
  operation: DeepDiffEntry["operation"];
};

export type DeepDiffSourceGroup = {
  key: string;
  label: string;
  changes: DeepDiffEntry[];
  objectChanges: DeepDiffEntry[];
  columns: DeepDiffColumnGroup[];
};

const ADDED_CATEGORIES = new Set([
  "dictionary_item_added",
  "iterable_item_added",
  "set_item_added",
]);
const REMOVED_CATEGORIES = new Set([
  "dictionary_item_removed",
  "iterable_item_removed",
  "set_item_removed",
]);

export const DEEP_DIFF_GROUP_LABELS: Record<DeepDiffGroup, string> = {
  attributes: "Attributes",
  entityProperties: "Entity properties",
  sources: "External sources",
  mappings: "Mappings",
  entity: "Entity",
};

export const DEEP_DIFF_GROUP_ORDER: DeepDiffGroup[] = [
  "attributes",
  "entityProperties",
  "sources",
  "mappings",
  "entity",
];

type PathSegment = string | number;

export function parseDeepDiffPath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const pattern = /\['((?:\\'|[^'])*)'\]|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(path)) !== null) {
    segments.push(match[2] === undefined ? match[1].replaceAll("\\'", "'") : Number(match[2]));
  }
  return segments;
}

export function groupAttributeChanges(changes: DeepDiffEntry[]): DeepDiffColumnGroup[] {
  const groups = new Map<string, DeepDiffColumnGroup>();
  for (const change of changes) {
    const label = change.displayPath.split(" › ")[0] || "Attribute";
    const key = `attribute:${label}`;
    const group = groups.get(key) || { key, label, changes: [], operation: change.operation };
    group.changes.push(change);
    group.operation = operationForGroup(group.changes);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function operationForGroup(changes: DeepDiffEntry[]): DeepDiffEntry["operation"] {
  if (changes.length > 0 && changes.every((change) => change.operation === "added")) return "added";
  if (
    changes.length > 0
    && changes.every((change) => change.operation === "removed")
    && changes.some((change) => {
      const segments = parseDeepDiffPath(change.path);
      return (change.group === "attributes" && segments[0] === "attributes" && segments.length === 2)
        || (change.group === "mappings"
          && segments[0] === "sources"
          && segments[2] === "mapping"
          && segments.length === 4);
    })
  ) return "removed";
  return "changed";
}

export function groupExternalSourceChanges(changes: DeepDiffEntry[]): DeepDiffSourceGroup[] {
  const groups = new Map<string, DeepDiffSourceGroup & { mappingChanges: DeepDiffEntry[] }>();
  for (const change of changes) {
    const segments = parseDeepDiffPath(change.path);
    const sourceIndex = typeof segments[1] === "number" ? segments[1] : null;
    const key = sourceIndex === null ? `source:${change.displayPath}` : `source:${sourceIndex}`;
    const label = change.displayPath.split(" › ")[0] || "External source";
    const group = groups.get(key) || {
      key,
      label,
      changes: [],
      objectChanges: [],
      columns: [],
      mappingChanges: [],
    };
    group.changes.push(change);
    if (change.group === "mappings") {
      group.mappingChanges.push(change);
    } else {
      group.objectChanges.push(change);
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((source) => ({
    key: source.key,
    label: source.label,
    changes: source.changes,
    objectChanges: source.objectChanges,
    columns: groupMappingChanges(source.mappingChanges),
  }));
}

function groupMappingChanges(changes: DeepDiffEntry[]): DeepDiffColumnGroup[] {
  const groups = new Map<string, DeepDiffColumnGroup>();
  for (const change of changes) {
    const segments = parseDeepDiffPath(change.path);
    const mappingIndex = typeof segments[3] === "number" ? segments[3] : change.displayPath;
    const pathParts = change.displayPath.split(" › ");
    const label = pathParts[1] || `Mapping ${mappingIndex}`;
    const key = `mapping:${segments[1] ?? "source"}:${label}`;
    const group = groups.get(key) || { key, label, changes: [], operation: change.operation };
    group.changes.push(change);
    group.operation = operationForGroup(group.changes);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function valueAt(root: unknown, segments: PathSegment[]): unknown {
  let value = root;
  for (const segment of segments) {
    if (value === null || value === undefined || typeof value !== "object") return undefined;
    value = (value as Record<string | number, unknown>)[segment];
  }
  return value;
}

function valueAtEither(
  before: unknown,
  after: unknown,
  segments: PathSegment[],
  operation: DeepDiffEntry["operation"],
): unknown {
  return operation === "removed"
    ? valueAt(before, segments) ?? valueAt(after, segments)
    : valueAt(after, segments) ?? valueAt(before, segments);
}

function groupFor(segments: PathSegment[]): DeepDiffGroup {
  if (segments[0] === "attributes") return "attributes";
  if (segments[0] === "properties") return "entityProperties";
  if (segments[0] === "sources") return segments.includes("mapping") ? "mappings" : "sources";
  return "entity";
}

function displayPathFor(
  path: string,
  before: unknown,
  after: unknown,
  operation: DeepDiffEntry["operation"],
): string {
  const segments = parseDeepDiffPath(path);
  const labels: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];

    if (segment === "attributes" && typeof next === "number") {
      const attribute = valueAtEither(before, after, ["attributes", next], operation) as any;
      labels.push(`${attribute?.name || `Attribute ${next + 1}`}`);
      index += 1;
      continue;
    }
    if (segment === "sources" && typeof next === "number") {
      const source = valueAtEither(before, after, ["sources", next], operation) as any;
      labels.push(`${source?.sourceAlias || source?.sourceLocation || `Source ${next + 1}`}`);
      index += 1;
      continue;
    }
    if (segment === "mapping" && typeof next === "number") {
      const sourceIndex = typeof segments[1] === "number" ? segments[1] : -1;
      const mapping = valueAtEither(
        before,
        after,
        ["sources", sourceIndex, "mapping", next],
        operation,
      ) as any;
      const sourceName = `${mapping?.sourceName || "?"}`;
      const targetName = `${mapping?.targetName || "?"}`;
      labels.push(`${sourceName} → ${targetName}`);
      index += 1;
      continue;
    }
    if (segment === "properties" && typeof next === "number") {
      const prefix = segments.slice(0, index + 2);
      const property = valueAtEither(before, after, prefix, operation) as any;
      labels.push(`${property?.property || `Property ${next + 1}`}`);
      index += 1;
      if (segments[index + 1] === "value") index += 1;
      continue;
    }
    if (typeof segment === "number") {
      labels.push(`${segment + 1}`);
      continue;
    }
    labels.push(segment);
  }

  return labels.join(" › ") || path;
}

function operationFor(category: string): DeepDiffEntry["operation"] {
  if (ADDED_CATEGORIES.has(category)) return "added";
  if (REMOVED_CATEGORIES.has(category)) return "removed";
  return "changed";
}

function entriesForCategory(
  category: string,
  payload: unknown,
  beforeEntity: unknown,
  afterEntity: unknown,
): DeepDiffEntry[] {
  const operation = operationFor(category);
  const records: Array<[string, unknown]> = Array.isArray(payload)
    ? payload.map((path) => [`${path}`, undefined])
    : payload && typeof payload === "object"
      ? Object.entries(payload as Record<string, unknown>)
      : [];

  return records.map(([path, detail]) => {
    const segments = parseDeepDiffPath(path);
    const changed = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
    const pathValueBefore = valueAt(beforeEntity, segments);
    const pathValueAfter = valueAt(afterEntity, segments);
    const before = operation === "added"
      ? undefined
      : Object.hasOwn(changed, "old_value") ? changed.old_value : detail ?? pathValueBefore;
    const after = operation === "removed"
      ? undefined
      : Object.hasOwn(changed, "new_value") ? changed.new_value : detail ?? pathValueAfter;

    return {
      id: `${category}:${path}`,
      category,
      operation,
      path,
      displayPath: displayPathFor(path, beforeEntity, afterEntity, operation),
      group: groupFor(segments),
      before,
      after,
      beforeType: typeof changed.old_type === "string" ? changed.old_type : undefined,
      afterType: typeof changed.new_type === "string" ? changed.new_type : undefined,
    };
  });
}

export function presentDeepDiff(
  diff: unknown,
  beforeEntity: unknown,
  afterEntity: unknown,
): DeepDiffEntry[] {
  if (!diff || typeof diff !== "object") return [];
  return Object.entries(diff as Record<string, unknown>).flatMap(([category, payload]) =>
    entriesForCategory(category, payload, beforeEntity, afterEntity),
  );
}

export function formatDeepDiffValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  if (typeof value === "number" || typeof value === "boolean") return `${value}`;
  return JSON.stringify(value, null, 2);
}
