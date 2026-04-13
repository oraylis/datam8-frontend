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

  const mappings = Array.isArray(source?.mapping) ? source.mapping : [];
  if (!mappings.length) return [];

  const detail = isRecord(dataSourceDetail) ? dataSourceDetail : {};
  const dataSourceType = isRecord(detail.dataSourceType) ? detail.dataSourceType : {};
  const typeMappings = toDataTypeMappings(dataSourceType.dataTypeMapping);
  const sourceMappings = toDataTypeMappings(detail.dataTypeMapping);
  const inheritedMappings = mergeInheritedDataTypeMappings(typeMappings, sourceMappings);
  const effectiveMappings = [...inheritedMappings, ...sourceMappings];
  const timestamp = nowIso || new Date().toISOString();

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

      return {
        name,
        attributeType: defaultAttributeType,
        dataType: canonicalDataType,
        dateAdded: timestamp,
        properties: [],
        __isNew: true,
        __modified: true,
      };
    })
    .filter((attribute): attribute is EntityAttribute => attribute !== null);
}

