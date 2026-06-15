type NumericLike = number | string | null | undefined;
type SourceDataType = {
  type?: string;
  nullable?: boolean;
  charLen?: NumericLike;
  precision?: NumericLike;
  scale?: NumericLike;
};

type PropertyAssignment = { property?: string; value?: string };
type SourceMapping = {
  sourceName?: string;
  targetName?: string;
  sourceDataType?: SourceDataType;
  properties?: PropertyAssignment[];
};

const normalizeNumeric = (value: NumericLike) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

export const normalizeDataTypeForSave = (dataType: unknown) => {
  if (!dataType || typeof dataType !== "object") return undefined;
  const typed = dataType as SourceDataType;
  const charLen = normalizeNumeric(typed.charLen);
  const precision = normalizeNumeric(typed.precision);
  const scale = normalizeNumeric(typed.scale);
  const hasAnyValue =
    typed.type !== undefined ||
    typed.nullable !== undefined ||
    charLen !== undefined ||
    precision !== undefined ||
    scale !== undefined;
  if (!hasAnyValue) return undefined;

  const out: SourceDataType = {};
  out.type = typed.type ?? "";
  out.nullable = typed.nullable !== undefined ? !!typed.nullable : true;
  if (charLen !== undefined) out.charLen = charLen;
  if (precision !== undefined) out.precision = precision;
  if (scale !== undefined) out.scale = scale;
  return out;
};

export const normalizePropertiesForSave = (props: PropertyAssignment[] | undefined) => {
  if (!Array.isArray(props)) return [];
  return props
    .map((p) => ({ property: (p?.property ?? "").trim(), value: (p?.value ?? "").trim() }))
    .filter((p) => p.property !== "" || p.value !== "");
};

export const normalizeMappingForSave = (mapping: SourceMapping[] | undefined) => {
  if (!Array.isArray(mapping)) return [];
  return mapping
    .map((m) => {
      const out: SourceMapping = {};
      const sourceName = (m?.sourceName ?? "").trim();
      const targetName = (m?.targetName ?? "").trim();
      if (sourceName) out.sourceName = sourceName;
      if (targetName) out.targetName = targetName;
      const normalizedDataType = normalizeDataTypeForSave(m?.sourceDataType);
      if (normalizedDataType) out.sourceDataType = normalizedDataType;
      const properties = normalizePropertiesForSave(m?.properties);
      if (properties.length) out.properties = properties;
      return out;
    })
    .filter((m) => Object.keys(m).length > 0);
};
