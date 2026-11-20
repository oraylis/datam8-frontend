import type { Quality } from "../../../generated-schema-types";

export type QualityCheck = Quality["checks"][number];
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const identifier = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(v);
const nonblank = (v: unknown): v is string =>
  typeof v === "string" && !!v.trim();

export function qualityErrors(value: unknown): string[] {
  if (value === undefined) return [];
  if (!record(value) || !Array.isArray(value.checks))
    return ["Quality requires a checks list."];
  const errors: string[] = [];
  if (
    Object.keys(value).some(
      (k) => !["checks", "maxFailureRatePct", "references"].includes(k),
    )
  )
    errors.push(
      "Unsupported Quality field. Use checks, maxFailureRatePct and references.",
    );
  if (
    "maxFailureRatePct" in value &&
    (typeof value.maxFailureRatePct !== "number" ||
      !Number.isFinite(value.maxFailureRatePct) ||
      value.maxFailureRatePct < 0 ||
      value.maxFailureRatePct > 100)
  )
    errors.push(
      "Failure percentage must be a finite number between 0 and 100.",
    );
  if ("references" in value) {
    if (!record(value.references))
      errors.push("References must be named entity bindings.");
    else
      for (const [alias, binding] of Object.entries(value.references)) {
        if (
          !identifier(alias) ||
          !record(binding) ||
          Object.keys(binding).length !== 1 ||
          typeof binding.entityId !== "number" ||
          !Number.isInteger(binding.entityId) ||
          binding.entityId < 0
        )
          errors.push(
            `Reference ${alias} requires a valid alias and exactly a nonnegative integer entityId.`,
          );
      }
  }
  const seen = new Set<string>();
  for (const check of value.checks) {
    if (!record(check)) {
      errors.push("Each quality check must be an object.");
      continue;
    }
    const label = typeof check.id === "string" ? check.id : "New check";
    if (!identifier(check.id)) errors.push(`${label}: Invalid check ID.`);
    else {
      if (seen.has(check.id)) errors.push(`${label}: ID must be unique.`);
      seen.add(check.id);
    }
    if (
      Object.keys(check).some(
        (k) =>
          ![
            "id",
            "execution",
            "expression",
            "severity",
            "description",
            "sql",
            "onEmpty",
          ].includes(k),
      )
    )
      errors.push(`${label}: Unsupported check field.`);
    if (check.execution !== "enforcement" && check.execution !== "monitoring")
      errors.push(`${label}: Select an execution mode.`);
    if (!nonblank(check.expression))
      errors.push(`${label}: Enter a SQL expression.`);
    if (
      "severity" in check &&
      check.severity !== "error" &&
      check.severity !== "warning"
    )
      errors.push(`${label}: Severity must be error or warning.`);
    if ("description" in check && typeof check.description !== "string")
      errors.push(`${label}: Description must be a string.`);
    if (
      "sql" in check &&
      (!nonblank(check.sql) || check.execution !== "monitoring")
    )
      errors.push(
        `${label}: SQL Query requires monitoring and a nonblank query.`,
      );
    if (
      "onEmpty" in check &&
      (!("sql" in check) ||
        (check.onEmpty !== "evaluate" && check.onEmpty !== "no_data"))
    )
      errors.push(
        `${label}: onEmpty requires SQL Query and must be evaluate or no_data.`,
      );
  }
  return errors;
}
