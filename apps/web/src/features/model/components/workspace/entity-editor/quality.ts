import type { Quality } from "../../../generated-schema-types";

export type QualityCheck = Quality["checks"][number];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finiteJson = (value: unknown): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteJson);
  return isRecord(value) && Object.values(value).every(finiteJson);
};

export function qualityErrors(value: unknown): string[] {
  if (value === undefined) return [];
  if (!isRecord(value) || !Array.isArray(value.checks))
    return ["Quality requires a checks list."];
  const errors: string[] = [];
  if (
    Object.keys(value).some(
      (key) => !["checks", "settings", "referenceDatasets"].includes(key),
    )
  )
    errors.push("Unknown Quality field.");
  if (value.settings !== undefined) {
    if (!isRecord(value.settings)) errors.push("Settings must be an object.");
    else {
      const threshold = value.settings.maxFailureRatePct;
      if (
        threshold !== undefined &&
        (typeof threshold !== "number" ||
          !Number.isFinite(threshold) ||
          threshold < 0 ||
          threshold > 100)
      )
        errors.push("Failure percentage must be between 0 and 100.");
      if (!finiteJson(value.settings))
        errors.push("Settings must contain finite JSON values.");
    }
  }
  if (value.referenceDatasets !== undefined) {
    if (!isRecord(value.referenceDatasets))
      errors.push("Reference datasets must be an object.");
    else
      for (const [alias, binding] of Object.entries(value.referenceDatasets)) {
        if (!alias.trim() || !isRecord(binding)) {
          errors.push(`Invalid reference dataset ${alias}.`);
          continue;
        }
        if (
          binding.entityId !== undefined &&
          (typeof binding.entityId !== "number" ||
            !Number.isInteger(binding.entityId) ||
            binding.entityId < 0)
        )
          errors.push(`Invalid entity ID for reference ${alias}.`);
        if (
          binding.execution !== undefined &&
          !["enforcement", "monitoring"].includes(String(binding.execution))
        )
          errors.push(`Invalid execution for reference ${alias}.`);
        if (!finiteJson(binding))
          errors.push(`Reference ${alias} must contain finite JSON values.`);
      }
  }
  const seen = new Set<string>();
  for (const check of value.checks) {
    if (!isRecord(check)) {
      errors.push("Invalid quality check.");
      continue;
    }
    const label = typeof check.id === "string" ? check.id : "New check";
    if (
      typeof check.id !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(check.id)
    )
      errors.push(`${label}: Invalid check ID.`);
    else {
      if (seen.has(check.id)) errors.push(`${label}: ID must be unique.`);
      seen.add(check.id);
    }
    if (!["enforcement", "monitoring"].includes(String(check.execution)))
      errors.push(`${label}: Select an execution mode.`);
    if (!isRecord(check.definition))
      errors.push(`${label}: Definition must be a JSON object.`);
    else if (!finiteJson(check.definition))
      errors.push(`${label}: Definition must contain finite JSON values.`);
    if (
      check.description !== undefined &&
      typeof check.description !== "string"
    )
      errors.push(`${label}: Description must be a string.`);
    if (
      Object.keys(check).some(
        (key) =>
          !["id", "execution", "description", "definition"].includes(key),
      )
    )
      errors.push(
        `${label}: Use id, execution and definition; legacy check fields require conversion.`,
      );
  }
  return errors;
}
