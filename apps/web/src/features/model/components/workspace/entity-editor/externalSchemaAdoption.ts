import {
  mapSourceDataTypeToCanonical,
  mergeInheritedDataTypeMappings,
  sanitizeDataType,
  type DataTypeMapping,
} from "../../../model-utils";
import type { EntityAttribute, EntitySource } from "./types";

type LooseRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is LooseRecord => !!value && typeof value === "object";

function toDataTypeMappings(input: unknown): DataTypeMapping[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry): DataTypeMapping | null => {
      if (!isRecord(entry)) return null;
      const sourceType = typeof entry.sourceType === "string" ? entry.sourceType.trim() : "";
      const targetType = typeof entry.targetType === "string" ? entry.targetType.trim() : "";
      if (!sourceType || !targetType) return null;
      return { sourceType, targetType };
    })
    .filter((entry): entry is DataTypeMapping => entry !== null);
}

export function buildAttributesFromExternalSourceSchema(params: {
  source: EntitySource;
  dataSourceDetail: unknown;
  canonicalDataTypes: string[];
  defaultAttributeType: string;
  nowIso?: string;
}): EntityAttribute[] {
  const { source, dataSourceDetail, canonicalDataTypes, defaultAttributeType, nowIso } = params;

  const detail = isRecord(dataSourceDetail) ? dataSourceDetail : {};
  const dataSourceType = isRecord(detail.dataSourceType) ? detail.dataSourceType : {};
  const typeMappings = toDataTypeMappings(dataSourceType.dataTypeMapping);
  const sourceMappings = toDataTypeMappings(detail.dataTypeMapping);
  const inheritedMappings = mergeInheritedDataTypeMappings(typeMappings, sourceMappings);
  const effectiveMappings = [...inheritedMappings, ...sourceMappings];
  const timestamp = nowIso || new Date().toISOString();

  // Prefer __uiExternalMeta.columns (the original fetched schema) so that columns
  // deleted from source.mapping can still be re-adopted.
  const uiMeta = isRecord((source as Record<string, unknown>).__uiExternalMeta)
    ? (source as Record<string, unknown>).__uiExternalMeta as LooseRecord
    : null;
  const metaColumns = Array.isArray(uiMeta?.columns) ? (uiMeta!.columns as unknown[]) : null;

  if (metaColumns) {
    return metaColumns
      .map((col): EntityAttribute | null => {
        if (!isRecord(col)) return null;
        const name = typeof col.name === "string" ? col.name.trim() : "";
        if (!name) return null;
        const rawType = typeof col.dataType === "string" ? col.dataType.trim() : "";
        if (!rawType) return null;
        const sourceDataType = sanitizeDataType({ type: rawType, nullable: col.isNullable ?? true });
        const canonicalDataType = mapSourceDataTypeToCanonical({
          sourceDataType,
          mappings: effectiveMappings,
          canonicalTypes: canonicalDataTypes,
        });
        const attr: EntityAttribute = {
          name,
          attributeType: defaultAttributeType,
          dataType: canonicalDataType,
          dateAdded: timestamp,
          properties: Array.isArray(col.properties) ? col.properties as EntityAttribute["properties"] : [],
          __isNew: true,
          __modified: true,
        };
        if (typeof col.description === "string" && col.description.trim()) {
          attr.description = col.description.trim();
        }
        return attr;
      })
      .filter((a): a is EntityAttribute => a !== null);
  }

  // Fall back to source.mapping when no cached meta is available.
  const mappings = Array.isArray(source?.mapping) ? source.mapping : [];
  if (!mappings.length) return [];

  return mappings
    .map((mapping): EntityAttribute | null => {
      if (!isRecord(mapping)) return null;

      const name = typeof mapping.targetName === "string" ? mapping.targetName.trim() : "";
      if (!name) return null;

      const rawSourceDataType = isRecord(mapping.sourceDataType) ? mapping.sourceDataType : null;
      const sourceTypeName = typeof rawSourceDataType?.type === "string" ? rawSourceDataType.type.trim() : "";
      if (!sourceTypeName) return null;

      const sourceDataType = sanitizeDataType(rawSourceDataType);
      const canonicalDataType = mapSourceDataTypeToCanonical({
        sourceDataType,
        mappings: effectiveMappings,
        canonicalTypes: canonicalDataTypes,
      });

      const attr: EntityAttribute = {
        name,
        attributeType: defaultAttributeType,
        dataType: canonicalDataType,
        dateAdded: timestamp,
        properties: Array.isArray(mapping.properties) ? mapping.properties as EntityAttribute["properties"] : [],
        __isNew: true,
        __modified: true,
      };
      if (typeof mapping.description === "string" && mapping.description.trim()) {
        attr.description = mapping.description.trim();
      }
      return attr;
    })
    .filter((attribute): attribute is EntityAttribute => attribute !== null);
}

