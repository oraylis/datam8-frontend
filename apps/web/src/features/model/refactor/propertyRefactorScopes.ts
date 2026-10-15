import type { BaseEntity } from "../model-types";
import { detectBaseType } from "../model-utils";

export const SUPPORTED_NON_BASE_SCOPE_TARGETS = ["entity", "folder"] as const;

export type SupportedNonBaseScopeTarget = (typeof SUPPORTED_NON_BASE_SCOPE_TARGETS)[number];
export type SupportedBaseScopeTarget = string;
export type PropertyRefactorScopeTarget = SupportedNonBaseScopeTarget | SupportedBaseScopeTarget;

const SCOPE_ALIAS_MAP: Record<string, PropertyRefactorScopeTarget> = {
  model: "entity",
  properties: "propertyValues",
};

const hasListProperties = (value: unknown): boolean =>
  Array.isArray(value) && value.some((item) => !!item && typeof item === "object" && Array.isArray((item as any).properties));

const hasNestedDataModuleProperties = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some(
    (item) =>
      !!item &&
      typeof item === "object" &&
      Array.isArray((item as any).dataModules) &&
      (item as any).dataModules.some((module: any) => !!module && typeof module === "object" && Array.isArray(module.properties)),
  );

const hasPropertyValueRows = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as any;
    return typeof row.property === "string" && typeof row.name === "string";
  });

const singularizeBaseType = (value: string): string => {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("ies")) return `${trimmed.slice(0, -3)}y`;
  if (trimmed.endsWith("s")) return trimmed.slice(0, -1);
  return trimmed;
};

export const normalizePropertyScopeTarget = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const alias = SCOPE_ALIAS_MAP[trimmed];
  return alias || trimmed;
};

export const isSupportedPropertyRefactorScopeTarget = (value: unknown): value is PropertyRefactorScopeTarget => {
  const normalized = normalizePropertyScopeTarget(value);
  if (!normalized) return false;
  if (normalized === "base" || normalized === "none") return false;
  return true;
};

export const collectAvailableBaseScopeTargets = (baseEntities: BaseEntity[]): SupportedBaseScopeTarget[] => {
  const targets = new Set<string>();

  baseEntities.forEach((entry) => {
    const type = detectBaseType(entry.content, entry.relPath).type;
    if (type === "propertyValues") {
      if (hasPropertyValueRows((entry.content as any)?.propertyValues)) {
        targets.add("propertyValues");
      }
      return;
    }
    const singularType = singularizeBaseType(type);
    if (!singularType || singularType === "propertie") return;
    if (hasListProperties((entry.content as any)?.[type])) {
      targets.add(singularType);
    }
    if (type === "dataProducts" && hasNestedDataModuleProperties((entry.content as any)?.dataProducts)) {
      targets.add("dataModule");
    }
  });

  return Array.from(targets).sort((a, b) => a.localeCompare(b));
};

export const buildPropertyScopeTypeOptions = (
  baseEntities: BaseEntity[],
  currentScopes: unknown[] = [],
): Array<{ value: string; label: string }> => {
  const options = [
    ...SUPPORTED_NON_BASE_SCOPE_TARGETS,
    ...collectAvailableBaseScopeTargets(baseEntities),
  ];
  const current = currentScopes
    .map((scope) => normalizePropertyScopeTarget((scope as any)?.type))
    .filter(Boolean);
  const merged = Array.from(new Set([...options, ...current]));
  return merged.map((value) => ({ value, label: value }));
};

export const buildPropertyScopeTargetIndex = (propertiesContent: unknown): Map<string, PropertyRefactorScopeTarget[]> => {
  const index = new Map<string, PropertyRefactorScopeTarget[]>();
  const list = Array.isArray((propertiesContent as any)?.properties) ? (propertiesContent as any).properties : [];
  list.forEach((row: any) => {
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (!name) return;
    const scopeList = Array.isArray(row?.scopes) ? row.scopes : [];
    const targets = scopeList
      .map((scope: any) => normalizePropertyScopeTarget(scope?.type))
      .filter((scope: string): scope is PropertyRefactorScopeTarget => isSupportedPropertyRefactorScopeTarget(scope));
    index.set(name, Array.from(new Set(targets)));
  });
  return index;
};
