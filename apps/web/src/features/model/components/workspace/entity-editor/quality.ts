import type { Quality } from "../../../generated-schema-types";

export type QualityCheck = Quality["checks"][number];
export const QUALITY_TYPES = [
  "dqx",
  "not_null",
  "range",
  "sql_expression",
  "completeness",
  "freshness",
  "row_count",
] as const;
const numericTypes = new Set([
  "byte",
  "short",
  "int",
  "integer",
  "long",
  "bigint",
  "smallint",
  "tinyint",
  "int8",
  "int16",
  "int32",
  "int64",
  "float",
  "double",
  "decimal",
  "numeric",
  "number",
]);
const timestampTypes = new Set([
  "timestamp",
  "datetime",
  "datetime2",
  "datetimeoffset",
  "timestamp_ntz",
]);
export const aggregateQualityType = (kind: string) =>
  ["completeness", "freshness", "row_count"].includes(kind);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finiteJson = (value: unknown): boolean =>
  typeof value === "number"
    ? Number.isFinite(value)
    : Array.isArray(value)
      ? value.every(finiteJson)
      : isRecord(value)
        ? Object.values(value).every(finiteJson)
        : true;

export function qualityErrors(
  value: unknown,
  attributes: Array<{
    name?: string;
    dateDeleted?: unknown;
    dataType?: { type?: string };
  }>,
): string[] {
  if (value === undefined) return [];
  if (
    !value ||
    typeof value !== "object" ||
    !("checks" in value) ||
    !Array.isArray(value.checks)
  )
    return ["Quality requires a checks list."];
  const q = value as Quality;
  const errors: string[] = [];
  const threshold = q.settings?.maxFailureRatePct;
  if (
    threshold !== undefined &&
    (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)
  )
    errors.push("Failure percentage must be between 0 and 100.");
  if (
    q.settings?.dependencies &&
    (!Array.isArray(q.settings.dependencies) ||
      q.settings.dependencies.some((v) => typeof v !== "string" || !v.trim()))
  )
    errors.push("Dependencies must be nonempty PyPI requirement strings.");
  if (q.referenceDatasets !== undefined) {
    if (!isRecord(q.referenceDatasets))
      errors.push("Reference datasets must be an object.");
    else
      for (const [alias, reference] of Object.entries(q.referenceDatasets)) {
        if (
          !alias.trim() ||
          !isRecord(reference) ||
          !(
            ("entityId" in reference &&
              !("table" in reference) &&
              Number.isInteger(reference.entityId) &&
              Number(reference.entityId) >= 0) ||
            ("table" in reference &&
              !("entityId" in reference) &&
              typeof reference.table === "string" &&
              reference.table.trim())
          ) ||
          (reference.execution !== undefined &&
            !["enforcement", "monitoring"].includes(
              String(reference.execution),
            ))
        )
          errors.push(`Invalid reference dataset ${alias}.`);
      }
  }
  const seen = new Set<string>();
  for (const raw of q.checks) {
    const c = raw as QualityCheck;
    if (!c || typeof c !== "object") {
      errors.push("Invalid quality check.");
      continue;
    }
    const label = c.id || "New check";
    const fail = (message: string) => errors.push(`${label}: ${message}`);
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c.id || ""))
      fail(
        "ID must start with a letter and contain only letters, numbers and underscores.",
      );
    if (seen.has(c.id)) fail("ID must be unique.");
    seen.add(c.id);
    if (!(QUALITY_TYPES as readonly string[]).includes(c.type))
      fail("Select a supported rule type.");
    if (c.type === "dqx") {
      const d = c.definition;
      if (
        !isRecord(d) ||
        !isRecord(d.check) ||
        typeof d.check.function !== "string" ||
        !d.check.function.trim()
      )
        fail("Enter a native DQX check.function.");
      if (
        d?.criticality !== undefined &&
        !["error", "warn"].includes(d.criticality)
      )
        fail("DQX criticality must be error or warn.");
      if (
        d?.check?.arguments !== undefined &&
        (!d.check.arguments ||
          typeof d.check.arguments !== "object" ||
          Array.isArray(d.check.arguments))
      )
        fail("DQX arguments must be a JSON object.");
      if (
        d?.check?.for_each_column != null &&
        (!Array.isArray(d.check.for_each_column) ||
          d.check.for_each_column.some((v) => typeof v !== "string"))
      )
        fail("DQX for_each_column must be a list of column expressions.");
      for (const key of ["filter", "message_expr", "name"] as const)
        if (d?.[key] != null && typeof d[key] !== "string")
          fail(`DQX ${key} must be a string.`);
      if (d?.user_metadata != null && !isRecord(d.user_metadata))
        fail("DQX user_metadata must be an object.");
      if (
        d?.user_metadata?.datam8_check_id !== undefined &&
        d.user_metadata.datam8_check_id !== c.id
      )
        fail("datam8_check_id is reserved for the rule ID.");
      if (!finiteJson(d))
        fail("DQX definition must contain finite JSON values.");
      if (!["enforcement", "monitoring"].includes(c.execution))
        fail("Select an execution mode.");
      continue;
    }
    if (!["error", "warning"].includes(c.severity)) fail("Select a severity.");
    if (
      !["enforcement", "monitoring"].includes(c.execution) ||
      (aggregateQualityType(c.type) && c.execution !== "monitoring")
    )
      fail("This rule requires monitoring.");
    if ("attribute" in c) {
      const a = attributes.find(
        (a) => a.name === c.attribute && !a.dateDeleted,
      );
      if (!a) fail("Select an active attribute.");
      if (
        a &&
        c.type === "range" &&
        !numericTypes.has(a.dataType?.type?.toLowerCase() || "")
      )
        fail("Range requires a numeric attribute.");
      if (
        a &&
        c.type === "freshness" &&
        !timestampTypes.has(a.dataType?.type?.toLowerCase() || "")
      )
        fail("Freshness requires a timestamp attribute.");
    } else if (!["sql_expression", "row_count"].includes(c.type))
      fail("Select an attribute.");
    const supplied = "parameters" in c ? c.parameters : {};
    const p = (
      supplied && typeof supplied === "object" ? supplied : {}
    ) as Record<string, unknown>;
    const number = (
      key: string,
      min?: number,
      max?: number,
      integer = false,
    ) => {
      const n = p[key];
      if (
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        (min !== undefined && n < min) ||
        (max !== undefined && n > max) ||
        (integer && !Number.isInteger(n))
      )
        fail(`Invalid ${key}.`);
    };
    if (c.type === "range" || c.type === "row_count") {
      const [low, high] =
        c.type === "range" ? ["min", "max"] : ["minCount", "maxCount"];
      if (p[low] === undefined && p[high] === undefined)
        fail("At least one bound is required.");
      for (const key of [low, high])
        if (p[key] !== undefined)
          number(
            key,
            c.type === "row_count" ? 0 : undefined,
            undefined,
            c.type === "row_count",
          );
      if (
        typeof p[low] === "number" &&
        typeof p[high] === "number" &&
        p[low] > p[high]
      )
        fail("Minimum must not exceed maximum.");
    }
    if (c.type === "completeness") number("minCompleteness", 0, 1);
    if (c.type === "freshness") number("maxAgeSeconds", 0, undefined, true);
    if (
      c.type === "sql_expression" &&
      (typeof p.expression !== "string" || !p.expression.trim())
    )
      fail("Enter a SQL expression.");
  }
  return errors;
}

export function renameQualityAttribute(
  quality: Quality | undefined,
  from: string,
  to: string,
): Quality | undefined {
  return (
    quality && {
      ...quality,
      checks: quality.checks.map((c) =>
        "attribute" in c && c.attribute === from ? { ...c, attribute: to } : c,
      ),
    }
  );
}
