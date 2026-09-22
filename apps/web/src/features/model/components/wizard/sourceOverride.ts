import type { SourceOverride } from "../../model-types";

type DataSourceRef = { name: string } | string;

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function toSourceOverride(input: unknown): SourceOverride | undefined {
  const rec = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
  if (!rec) return undefined;

  const dataSource = nonEmptyString(rec.dataSource);
  const sourceLocation = nonEmptyString(rec.sourceLocation);
  if (!dataSource && !sourceLocation) return undefined;

  return {
    ...(dataSource ? { dataSource } : {}),
    ...(sourceLocation ? { sourceLocation } : {}),
  };
}

export function resolveSourceOverride(args: {
  sourceOverride: SourceOverride | undefined;
  fallbackDataSource: string | undefined;
  fallbackLocation: string | number | undefined;
  dataSources: DataSourceRef[];
}) {
  const { sourceOverride, fallbackDataSource, fallbackLocation, dataSources } = args;
  const names = new Set(
    dataSources
      .map((entry) => (typeof entry === "string" ? entry : entry.name))
      .filter((name) => typeof name === "string" && name.trim().length > 0),
  );
  const overrideDataSource = sourceOverride?.dataSource?.trim();

  return {
    dataSource: overrideDataSource && names.has(overrideDataSource) ? overrideDataSource : fallbackDataSource,
    sourceLocation: sourceOverride?.sourceLocation?.trim() || fallbackLocation,
  };
}
