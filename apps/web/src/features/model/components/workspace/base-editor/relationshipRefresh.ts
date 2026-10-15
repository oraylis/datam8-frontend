type SourceFieldLike = {
  name?: string;
  relationships?: unknown;
};

type ModelEntityLike = {
  name?: string;
  content?: {
    id?: string | number;
    name?: string;
    displayName?: string;
  };
};

export type RelationshipChangeType =
  | "RELATIONSHIP_ADDED"
  | "RELATIONSHIP_REMOVED"
  | "RELATIONSHIP_MAPPING_CHANGED";

export type NormalizedRelationshipMapping = {
  sourceName: string;
  targetName: string;
};

export type NormalizedRelationship = {
  key: string;
  label: string;
  dataSource?: string;
  targetLocation: string | number;
  alias?: string;
  attributes: NormalizedRelationshipMapping[];
};

export type RelationshipChange = {
  changeType: RelationshipChangeType;
  columnName: string;
  sourceBefore?: NormalizedRelationship;
  sourceAfter?: NormalizedRelationship;
  applyToEntitySuggested: boolean;
};

function nonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = nonEmptyString(value);
  if (!text) return undefined;
  return /^\d+$/.test(text) ? Number(text) : text;
}

function relationshipKey(input: {
  dataSource?: string;
  targetLocation: string | number;
  alias?: string;
}): string {
  const alias = input.alias || "";
  if (input.dataSource) {
    return `external\n${input.dataSource}\n${input.targetLocation}\n${alias}`;
  }
  return `internal\n${input.targetLocation}\n${alias}`;
}

function relationshipLabel(input: {
  dataSource?: string;
  targetLocation: string | number;
  alias?: string;
}): string {
  const target = input.alias || `${input.targetLocation}`;
  return input.dataSource ? `Relationship ${input.dataSource}:${target}` : `Relationship ${target}`;
}

function mappingKey(mapping: NormalizedRelationshipMapping): string {
  return `${mapping.sourceName}\n${mapping.targetName}`;
}

function normalizedMappings(input: unknown): NormalizedRelationshipMapping[] {
  const rows = Array.isArray(input) ? input : [];
  const byKey = new Map<string, NormalizedRelationshipMapping>();
  rows.forEach((row) => {
    const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const sourceName = nonEmptyString(rec?.sourceName);
    const targetName = nonEmptyString(rec?.targetName);
    if (!sourceName || !targetName) return;
    byKey.set(mappingKey({ sourceName, targetName }), { sourceName, targetName });
  });
  return Array.from(byKey.values()).sort((a, b) => mappingKey(a).localeCompare(mappingKey(b)));
}

function normalizeEntityName(value: unknown): string {
  return nonEmptyString(value).toLowerCase();
}

export function buildRefreshEntityNameResolver(
  entities: ModelEntityLike[],
): (targetEntityName: string) => string | number | undefined {
  const byName = new Map<string, Array<string | number | undefined>>();
  entities.forEach((entity) => {
    const names = new Set(
      [entity.name, entity.content?.name, entity.content?.displayName]
        .map(normalizeEntityName)
        .filter(Boolean),
    );
    names.forEach((name) => {
      byName.set(name, [...(byName.get(name) || []), entity.content?.id]);
    });
  });
  return (targetEntityName: string) => {
    const matches = byName.get(normalizeEntityName(targetEntityName)) || [];
    if (matches.length !== 1) return undefined;
    return matches[0];
  };
}

export function normalizeEntityRelationships(input: unknown): NormalizedRelationship[] {
  const rows = Array.isArray(input) ? input : [];
  const grouped = new Map<string, NormalizedRelationship>();
  rows.forEach((row) => {
    const rec = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
    const targetLocation = normalizeId(rec?.targetLocation);
    if (targetLocation === undefined) return;
    const dataSource = nonEmptyString(rec?.dataSource) || undefined;
    const alias = nonEmptyString(rec?.alias) || undefined;
    const attributes = normalizedMappings(rec?.attributes);
    if (!attributes.length) return;
    const key = relationshipKey({ dataSource, targetLocation, alias });
    const current =
      grouped.get(key) ||
      {
        key,
        label: relationshipLabel({ dataSource, targetLocation, alias }),
        ...(dataSource ? { dataSource } : {}),
        targetLocation,
        ...(alias ? { alias } : {}),
        attributes: [],
      };
    current.attributes = normalizedMappings([...current.attributes, ...attributes]);
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export function relationshipsFromSourceFields(
  fields: SourceFieldLike[],
  resolveInternalTarget?: (targetEntityName: string) => string | number | undefined,
): NormalizedRelationship[] {
  const grouped = new Map<string, NormalizedRelationship>();
  fields.forEach((field) => {
    const relationships = Array.isArray(field.relationships) ? field.relationships : [];
    relationships.forEach((entry) => {
      const rec = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      const sourceName = nonEmptyString(rec?.sourceName) || nonEmptyString(field.name);
      const targetName = nonEmptyString(rec?.targetName);
      if (!sourceName || !targetName) return;

      let dataSource: string | undefined;
      let targetLocation: string | number | undefined;
      const alias = nonEmptyString(rec?.alias) || undefined;
      if (rec?.relationshipType === "internal") {
        const targetEntityName = nonEmptyString(rec?.targetEntityName);
        targetLocation = targetEntityName ? resolveInternalTarget?.(targetEntityName) : undefined;
      } else {
        dataSource = nonEmptyString(rec?.dataSource) || undefined;
        targetLocation = nonEmptyString(rec?.targetLocation) || undefined;
      }
      if (targetLocation === undefined || (rec?.relationshipType !== "internal" && !dataSource)) return;

      const key = relationshipKey({ dataSource, targetLocation, alias });
      const current =
        grouped.get(key) ||
        {
          key,
          label: relationshipLabel({ dataSource, targetLocation, alias }),
          ...(dataSource ? { dataSource } : {}),
          targetLocation,
          ...(alias ? { alias } : {}),
          attributes: [],
        };
      current.attributes = normalizedMappings([...current.attributes, { sourceName, targetName }]);
      grouped.set(key, current);
    });
  });
  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function mappingsEqual(a: NormalizedRelationship, b: NormalizedRelationship): boolean {
  const left = a.attributes.map(mappingKey);
  const right = b.attributes.map(mappingKey);
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

export function diffRelationships(
  currentRelationships: unknown,
  desiredRelationships: NormalizedRelationship[],
): RelationshipChange[] {
  const current = new Map(normalizeEntityRelationships(currentRelationships).map((rel) => [rel.key, rel]));
  const desired = new Map(desiredRelationships.map((rel) => [rel.key, rel]));
  const changes: RelationshipChange[] = [];

  desired.forEach((after, key) => {
    const before = current.get(key);
    if (!before) {
      changes.push({
        changeType: "RELATIONSHIP_ADDED",
        columnName: after.label,
        sourceAfter: after,
        applyToEntitySuggested: false,
      });
      return;
    }
    if (!mappingsEqual(before, after)) {
      changes.push({
        changeType: "RELATIONSHIP_MAPPING_CHANGED",
        columnName: after.label,
        sourceBefore: before,
        sourceAfter: after,
        applyToEntitySuggested: false,
      });
    }
  });

  current.forEach((before, key) => {
    if (desired.has(key)) return;
    changes.push({
      changeType: "RELATIONSHIP_REMOVED",
      columnName: before.label,
      sourceBefore: before,
      applyToEntitySuggested: false,
    });
  });

  return changes.sort((a, b) => `${a.columnName}\n${a.changeType}`.localeCompare(`${b.columnName}\n${b.changeType}`));
}

function toModelRelationship(rel: NormalizedRelationship): Record<string, unknown> {
  return {
    ...(rel.dataSource ? { dataSource: rel.dataSource } : {}),
    targetLocation: rel.targetLocation,
    ...(rel.alias ? { alias: rel.alias } : {}),
    attributes: rel.attributes.map((mapping) => ({ ...mapping })),
  };
}

export function applyRelationshipChange(
  relationships: unknown,
  change: RelationshipChange,
): Record<string, unknown>[] {
  const byKey = new Map(normalizeEntityRelationships(relationships).map((rel) => [rel.key, rel]));
  if (change.changeType === "RELATIONSHIP_REMOVED") {
    const before = change.sourceBefore;
    if (before) byKey.delete(before.key);
  } else if (change.sourceAfter) {
    byKey.set(change.sourceAfter.key, change.sourceAfter);
  }
  return Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key)).map(toModelRelationship);
}

export function relationshipSummary(rel?: NormalizedRelationship): string {
  if (!rel) return "";
  const target = rel.dataSource ? `${rel.dataSource}:${rel.targetLocation}` : `${rel.targetLocation}`;
  const mappings = rel.attributes.map((mapping) => `${mapping.sourceName} -> ${mapping.targetName}`).join(", ");
  return `${target}${rel.alias ? ` (${rel.alias})` : ""}${mappings ? ` | ${mappings}` : ""}`;
}
