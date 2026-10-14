export type DeepDiffGroup =
  | "attributes"
  | "entityProperties"
  | "sources"
  | "mappings"
  | "entity";

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
  /** Snapshots are only used for presentation; the generator entries remain authoritative. */
  context?: { before: unknown; after: unknown };
};

export type DeepDiffColumnGroup = {
  key: string;
  label: string;
  changes: DeepDiffEntry[];
  operation: DeepDiffEntry["operation"];
  fields: DeepDiffEntry[];
};

export type DeepDiffSourceGroup = {
  key: string;
  label: string;
  changes: DeepDiffEntry[];
  objectChanges: DeepDiffEntry[];
  columns: DeepDiffColumnGroup[];
  operation: DeepDiffEntry["operation"];
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
    segments.push(
      match[2] === undefined
        ? match[1].replaceAll("\\'", "'")
        : Number(match[2]),
    );
  }
  return segments;
}

export function groupAttributeChanges(
  changes: DeepDiffEntry[],
): DeepDiffColumnGroup[] {
  const groups = new Map<string, DeepDiffColumnGroup>();
  for (const change of changes) {
    for (const field of readableChangeFields(change)) {
      const index = parseDeepDiffPath(field.path)[1];
      const removed =
        change.operation === "removed" &&
        parseDeepDiffPath(change.path).length <= 2;
      const snapshot = valueAt(
        removed ? change.context?.before : change.context?.after,
        ["attributes", index],
      ) as Record<string, unknown> | undefined;
      const label = `${snapshot?.name || field.displayPath.split(" › ")[0] || "Attribute"}`;
      const key = `attribute:${index}:${removed ? "removed" : "current"}`;
      const group = groups.get(key) || {
        key,
        label,
        changes: [],
        fields: [],
        operation: change.operation,
      };
      if (!group.changes.includes(change)) group.changes.push(change);
      group.fields.push(field);
      group.operation = objectOperation(group.changes, ["attributes", index]);
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

export function operationForGroup(
  changes: DeepDiffEntry[],
): DeepDiffEntry["operation"] {
  const isWholeObject = (change: DeepDiffEntry) => {
    const segments = parseDeepDiffPath(change.path);
    return (
      (segments[0] === "attributes" && segments.length <= 2) ||
      (segments[0] === "sources" &&
        (segments.length <= 2 ||
          (segments[2] === "mapping" && segments.length <= 4)))
    );
  };
  if (
    changes.length > 0 &&
    changes.every((change) => change.operation === "added") &&
    changes.some(isWholeObject)
  )
    return "added";
  if (
    changes.length > 0 &&
    changes.every((change) => change.operation === "removed") &&
    changes.some(isWholeObject)
  )
    return "removed";
  return "changed";
}

function objectOperation(
  changes: DeepDiffEntry[],
  path: PathSegment[],
): DeepDiffEntry["operation"] {
  const wholeChanges = changes.filter(
    (change) => parseDeepDiffPath(change.path).length <= path.length,
  );
  const explicit = operationForGroup(wholeChanges);
  if (explicit !== "changed") return explicit;
  const context = changes[0]?.context;
  if (context) {
    const before = valueAt(context.before, path);
    const after = valueAt(context.after, path);
    if (before === undefined && after !== undefined) return "added";
    if (after === undefined && before !== undefined) return "removed";
  }
  return "changed";
}

export function groupExternalSourceChanges(
  changes: DeepDiffEntry[],
): DeepDiffSourceGroup[] {
  const groups = new Map<string, DeepDiffSourceGroup>();
  for (const change of changes) {
    for (const field of readableChangeFields(change)) {
      const segments = parseDeepDiffPath(field.path);
      const sourceIndex = typeof segments[1] === "number" ? segments[1] : null;
      const originalSegments = parseDeepDiffPath(change.path);
      const removedSource =
        change.operation === "removed" && originalSegments.length <= 2;
      const snapshot = (
        removedSource
          ? valueAt(change.context?.before, segments.slice(0, 2))
          : valueAt(change.context?.after, segments.slice(0, 2))
      ) as Record<string, unknown> | undefined;
      const label = `${snapshot?.sourceAlias || snapshot?.sourceLocation || field.displayPath.split(" › ")[0] || "External source"}`;
      const key =
        sourceIndex === null
          ? `source:${label}`
          : `source:${sourceIndex}:${removedSource ? "removed" : "current"}`;
      const group = groups.get(key) || {
        key,
        label,
        changes: [],
        objectChanges: [],
        columns: [],
        operation: "changed" as const,
      };
      if (!group.changes.includes(change)) group.changes.push(change);
      // Only an entire source addition/removal changes the source's status.
      group.operation = objectOperation(group.changes, segments.slice(0, 2));
      if (field.group === "mappings") {
        const removedMapping =
          change.operation === "removed" && originalSegments.length <= 4;
        const mappingSnapshot = (
          removedMapping
            ? valueAt(change.context?.before, segments.slice(0, 4))
            : valueAt(change.context?.after, segments.slice(0, 4))
        ) as Record<string, unknown> | undefined;
        const mappingLabel = mappingSnapshot
          ? `${mappingSnapshot.sourceName || "?"} → ${mappingSnapshot.targetName || "?"}`
          : field.displayPath.split(" › ")[1] || "Mapping";
        const mappingKey = `mapping:${segments[1]}:${segments[3]}:${removedMapping ? "removed" : "current"}`;
        let mapping = group.columns.find((column) => column.key === mappingKey);
        if (!mapping) {
          mapping = {
            key: mappingKey,
            label: mappingLabel,
            changes: [],
            fields: [],
            operation: "changed",
          };
          group.columns.push(mapping);
        }
        if (!mapping.changes.includes(change)) mapping.changes.push(change);
        mapping.fields.push(field);
        mapping.operation = objectOperation(
          mapping.changes,
          segments.slice(0, 4),
        );
      } else {
        group.objectChanges.push(field);
      }
      groups.set(key, group);
    }
  }
  return [...groups.values()];
}

/** The top-level review counts each affected source, model column or entity field once. */
export function affectedChanges(
  changes: DeepDiffEntry[],
): Array<{ key: string; operation: DeepDiffEntry["operation"] }> {
  const sources = groupExternalSourceChanges(
    changes.filter(
      (change) => change.group === "sources" || change.group === "mappings",
    ),
  );
  const columns = groupAttributeChanges(
    changes.filter((change) => change.group === "attributes"),
  );
  const fields = new Map<string, DeepDiffEntry[]>();
  for (const change of changes.filter(
    (entry) => entry.group === "entity" || entry.group === "entityProperties",
  )) {
    for (const field of readableChangeFields(change)) {
      const key = field.displayPath.split(" › ")[0];
      const entries = fields.get(key) || [];
      if (!entries.includes(change)) entries.push(change);
      fields.set(key, entries);
    }
  }
  return [
    ...sources.map(({ key, operation }) => ({ key, operation })),
    ...columns.map(({ key, operation }) => ({ key, operation })),
    ...[...fields].map(([key, entries]) => {
      const segments = parseDeepDiffPath(entries[0].path);
      const objectPath = segments.slice(
        0,
        segments[0] === "properties" ? 2 : 1,
      );
      const whole = entries.find(
        (entry) => parseDeepDiffPath(entry.path).length === objectPath.length,
      );
      return {
        key: `field:${key}`,
        operation: whole?.operation || objectOperation(entries, objectPath),
      };
    }),
  ];
}

/** Expand object-level diffs into readable leaves without adding generator changes. */
export function readableChangeFields(change: DeepDiffEntry): DeepDiffEntry[] {
  const fields: DeepDiffEntry[] = [];
  const append = (before: unknown, after: unknown, segments: PathSegment[]) => {
    const operation =
      before === undefined
        ? "added"
        : after === undefined
          ? "removed"
          : "changed";
    const path = `root${segments.map((segment) => (typeof segment === "number" ? `[${segment}]` : `['${segment.replaceAll("'", "\\'")}']`)).join("")}`;
    fields.push({
      ...change,
      id: `${change.id}:${path}:${operation}`,
      path,
      before,
      after,
      operation,
      group: groupFor(segments),
      displayPath: displayPathFor(
        path,
        change.context?.before,
        change.context?.after,
        operation,
      ),
      beforeType:
        segments.length === parseDeepDiffPath(change.path).length
          ? change.beforeType
          : undefined,
      afterType:
        segments.length === parseDeepDiffPath(change.path).length
          ? change.afterType
          : undefined,
    });
  };
  const walk = (before: unknown, after: unknown, segments: PathSegment[]) => {
    if (
      JSON.stringify(before) === JSON.stringify(after) &&
      !(
        segments.length === parseDeepDiffPath(change.path).length &&
        change.beforeType !== change.afterType
      )
    )
      return;
    const oldRecord =
      before !== null && typeof before === "object"
        ? (before as Record<string, unknown>)
        : null;
    const newRecord =
      after !== null && typeof after === "object"
        ? (after as Record<string, unknown>)
        : null;
    if (oldRecord || newRecord) {
      // Preserve the scalar side of scalar/object type changes as its own readable row.
      if (!oldRecord && before !== undefined)
        append(before, undefined, segments);
      if (!newRecord && after !== undefined) append(undefined, after, segments);
      const keys = [
        ...new Set([
          ...Object.keys(oldRecord || {}),
          ...Object.keys(newRecord || {}),
        ]),
      ];
      for (const key of keys) {
        // A PropertyReference is displayed by its property name, never as an object.
        if (
          key === "property" &&
          segments.at(-2) === "properties" &&
          (!oldRecord ||
            !newRecord ||
            oldRecord.property === newRecord.property)
        )
          continue;
        walk(oldRecord?.[key], newRecord?.[key], [
          ...segments,
          Array.isArray(before) || Array.isArray(after) ? Number(key) : key,
        ]);
      }
      if (keys.length) return;
      if (segments.at(-1) === "mapping" || segments.at(-1) === "properties")
        return;
      before = oldRecord ? "Empty" : before;
      after = newRecord ? "Empty" : after;
    }
    append(before, after, segments);
  };
  walk(change.before, change.after, parseDeepDiffPath(change.path));
  return fields;
}

export function readableFieldLabel(path: string): string {
  const labels: Record<string, string> = {
    sourceName: "Source column",
    targetName: "Target column",
    sourceLocation: "Location",
    metadataLocation: "Metadata location",
    sourceAlias: "Alias",
    dataSource: "Data source",
    sourceDataType: "Data type",
    dataType: "Data type",
    type: "Data type",
    nullable: "Nullable",
    precision: "Precision",
    scale: "Scale",
    charLen: "Length",
    description: "Description",
    displayName: "Display name",
    name: "Name",
    attributeType: "Attribute type",
  };
  const parts = path.split(" › ");
  if (
    parts.length === 2 &&
    (parts[0] === "sourceDataType" || parts[0] === "dataType")
  )
    return labels[parts[1]] || parts[1];
  return parts.map((part) => labels[part] || part).join(" › ");
}

function valueAt(root: unknown, segments: PathSegment[]): unknown {
  let value = root;
  for (const segment of segments) {
    if (value === null || value === undefined || typeof value !== "object")
      return undefined;
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
    ? (valueAt(before, segments) ?? valueAt(after, segments))
    : (valueAt(after, segments) ?? valueAt(before, segments));
}

function groupFor(segments: PathSegment[]): DeepDiffGroup {
  if (segments[0] === "attributes") return "attributes";
  if (segments[0] === "properties") return "entityProperties";
  if (segments[0] === "sources")
    return segments.includes("mapping") ? "mappings" : "sources";
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
      const attribute = valueAtEither(
        before,
        after,
        ["attributes", next],
        operation,
      ) as any;
      labels.push(`${attribute?.name || `Attribute ${next + 1}`}`);
      index += 1;
      continue;
    }
    if (segment === "sources" && typeof next === "number") {
      const source = valueAtEither(
        before,
        after,
        ["sources", next],
        operation,
      ) as any;
      labels.push(
        `${source?.sourceAlias || source?.sourceLocation || `Source ${next + 1}`}`,
      );
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
    const changed =
      detail && typeof detail === "object"
        ? (detail as Record<string, unknown>)
        : {};
    const pathValueBefore = valueAt(beforeEntity, segments);
    const pathValueAfter = valueAt(afterEntity, segments);
    const before =
      operation === "added"
        ? undefined
        : Object.hasOwn(changed, "old_value")
          ? changed.old_value
          : (detail ?? pathValueBefore);
    const after =
      operation === "removed"
        ? undefined
        : Object.hasOwn(changed, "new_value")
          ? changed.new_value
          : (detail ?? pathValueAfter);

    return {
      id: `${category}:${path}`,
      category,
      operation,
      path,
      displayPath: displayPathFor(path, beforeEntity, afterEntity, operation),
      group: groupFor(segments),
      before,
      after,
      beforeType:
        typeof changed.old_type === "string" ? changed.old_type : undefined,
      afterType:
        typeof changed.new_type === "string" ? changed.new_type : undefined,
      context: { before: beforeEntity, after: afterEntity },
    };
  });
}

export function presentDeepDiff(
  diff: unknown,
  beforeEntity: unknown,
  afterEntity: unknown,
): DeepDiffEntry[] {
  if (!diff || typeof diff !== "object") return [];
  return Object.entries(diff as Record<string, unknown>).flatMap(
    ([category, payload]) =>
      entriesForCategory(category, payload, beforeEntity, afterEntity),
  );
}

export function formatDeepDiffValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value || '""';
  if (typeof value === "number" || typeof value === "boolean")
    return `${value}`;
  return JSON.stringify(value, null, 2);
}
