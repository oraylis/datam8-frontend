export type ExternalSchemaScope =
  | { kind: "all" }
  | { kind: "dataSource"; dataSourceName: string }
  | { kind: "entitySource"; dataSourceName: string; entityRelPath: string; sourceIndex: number }
  | { kind: "browseSource" | "browseRelationship"; dataSourceName: string; sourceLocation: string };

export type ExternalSchemaUsage = {
  dataSource: string;
  entityRelPath: string;
  sourceIndex: number;
};

export function isUsageInExternalSchemaScope(scope: ExternalSchemaScope, usage: ExternalSchemaUsage): boolean {
  return scope.kind === "all" || usage.dataSource === scope.dataSourceName;
}

export function isUsageInitiallySelected(scope: ExternalSchemaScope, usage: ExternalSchemaUsage): boolean {
  if (scope.kind !== "entitySource") return true;
  return usage.dataSource === scope.dataSourceName &&
    usage.entityRelPath === scope.entityRelPath &&
    usage.sourceIndex === scope.sourceIndex;
}

export function groupExternalSchemaUsages<T extends ExternalSchemaUsage>(usages: T[]): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  usages.forEach((usage) => groups.set(usage.dataSource, [...(groups.get(usage.dataSource) || []), usage]));
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
}

export function isSchemaChangeSuggested(changeType: string): boolean {
  return changeType !== "REMOVED_COLUMN" && changeType !== "RELATIONSHIP_REMOVED";
}

export function keepRelationshipMappingsForColumns<T extends { target?: string }>(
  mappings: T[],
  columns: Array<{ name?: string }>,
): T[] {
  const names = new Set(columns.map((column) => `${column?.name || ""}`).filter(Boolean));
  return mappings.filter((mapping) => !!mapping.target && names.has(mapping.target));
}
