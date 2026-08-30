import { normalizeDataTypeForSave } from "../utils/sourceNormalization";

export type ColumnSchemaChangeType =
  | "NEW_COLUMN"
  | "REMOVED_COLUMN"
  | "TYPE_CHANGED"
  | "NULLABILITY_CHANGED"
  | "PK_CHANGED"
  | "DESCRIPTION_CHANGED"
  | "PROPERTIES_CHANGED";

export type ColumnSchemaChange = {
  changeType: ColumnSchemaChangeType;
  columnName: string;
  sourceBefore?: any;
  sourceAfter?: any;
  entityAttributeName?: string;
  applyToEntitySuggested?: boolean;
};

type IndexedColumnSchemaChange = ColumnSchemaChange & { originalIndex: number };

const buildSourceDataType = (sourceField: any) =>
  normalizeDataTypeForSave(sourceField?.sourceDataType || {
    type: sourceField?.dataType,
    nullable: sourceField?.isNullable,
    charLen: sourceField?.maxLength,
    precision: sourceField?.numericPrecision,
    scale: sourceField?.numericScale ?? sourceField?.numbericScale,
  });

function buildSourceMappingFromField(columnName: string, sourceField: any, targetName?: string) {
  const mapping: any = {
    sourceName: columnName,
    targetName: targetName || columnName,
  };
  const sourceDataType = buildSourceDataType(sourceField);
  if (sourceDataType) mapping.sourceDataType = sourceDataType;
  if (Array.isArray(sourceField?.properties) && sourceField.properties.length > 0) {
    mapping.properties = sourceField.properties;
  }
  return mapping;
}

const sourceOrdinalIndex = (sourceField: any, fallbackLength: number) => {
  const ordinal = Number(sourceField?.ordinal);
  return Number.isFinite(ordinal) && ordinal > 0
    ? Math.min(Math.max(Math.trunc(ordinal) - 1, 0), fallbackLength)
    : fallbackLength;
};

const findAttrIndexByName = (attrs: any[], name: string) =>
  attrs.findIndex((attr: any) => `${attr?.name || ""}`.trim() === name);

const findTargetAttrInsertIndex = (attrs: any[], sourceMappings: any[], mappingIndex: number) => {
  for (let index = mappingIndex + 1; index < sourceMappings.length; index += 1) {
    const targetName = `${sourceMappings[index]?.targetName || ""}`.trim();
    if (!targetName) continue;
    const attrIndex = findAttrIndexByName(attrs, targetName);
    if (attrIndex >= 0) return attrIndex;
  }
  return attrs.length;
};

const sortBySourceOrdinal = (changes: ColumnSchemaChange[]): ColumnSchemaChange[] =>
  changes
    .map((change, originalIndex): IndexedColumnSchemaChange => ({ ...change, originalIndex }))
    .sort((a, b) => {
      const aOrdinal = Number(a.sourceAfter?.ordinal);
      const bOrdinal = Number(b.sourceAfter?.ordinal);
      const aHasOrdinal = Number.isFinite(aOrdinal) && aOrdinal > 0;
      const bHasOrdinal = Number.isFinite(bOrdinal) && bOrdinal > 0;
      if (aHasOrdinal && bHasOrdinal) return aOrdinal - bOrdinal || a.originalIndex - b.originalIndex;
      if (aHasOrdinal) return -1;
      if (bHasOrdinal) return 1;
      return a.originalIndex - b.originalIndex;
    });

export function applyColumnSchemaChangesToEntityContent(
  nextContent: any,
  sourceIndex: number,
  changes: ColumnSchemaChange[],
  selectedKeys: Set<string>,
) {
  const attrs = Array.isArray(nextContent.attributes) ? nextContent.attributes : [];
  const sources = Array.isArray(nextContent.sources) ? nextContent.sources : [];
  const sourceEntry = sources[sourceIndex];
  const sourceMappings = Array.isArray(sourceEntry?.mapping) ? sourceEntry.mapping : [];

  const findSourceMappingIndex = (columnName: string) =>
    sourceMappings.findIndex((m: any) => {
      const sourceName = `${m?.sourceName || ""}`.trim();
      return sourceName === columnName;
    });

  for (const change of sortBySourceOrdinal(changes)) {
    const marker = `${change.columnName}::${change.changeType}`;
    if (!selectedKeys.has(marker)) continue;

    if (change.changeType === "TYPE_CHANGED" || change.changeType === "NULLABILITY_CHANGED") {
      const mappingIndex = findSourceMappingIndex(change.columnName);
      if (mappingIndex >= 0) {
        const mappingItem = sourceMappings[mappingIndex] || {};
        const currentSourceDataType = normalizeDataTypeForSave(mappingItem?.sourceDataType) || {};
        const nextSourceDataType = buildSourceDataType(change.sourceAfter);
        if (nextSourceDataType) {
          sourceMappings[mappingIndex] = {
            ...mappingItem,
            sourceDataType: {
              ...currentSourceDataType,
              ...nextSourceDataType,
            },
          };
        }
      }
      continue;
    }

    const attrKey = `${change.entityAttributeName || change.columnName || ""}`.trim();
    const existingAttrIndex = attrKey ? findAttrIndexByName(attrs, attrKey) : -1;
    const existingAttr = existingAttrIndex >= 0 ? attrs[existingAttrIndex] : undefined;

    if (change.changeType === "NEW_COLUMN") {
      const targetName = existingAttr?.name || change.columnName;
      let mappingIndex = findSourceMappingIndex(change.columnName);
      if (mappingIndex < 0) {
        mappingIndex = sourceOrdinalIndex(change.sourceAfter, sourceMappings.length);
        sourceMappings.splice(mappingIndex, 0, buildSourceMappingFromField(change.columnName, change.sourceAfter, targetName));
      }
      if (!existingAttr) {
        const attrInsertIndex = findTargetAttrInsertIndex(attrs, sourceMappings, mappingIndex);
        attrs.splice(attrInsertIndex, 0, {
          ordinalNumber: attrs.length + 1,
          name: change.columnName,
          attributeType: "Regular",
          dataType: {
            type: `${change.sourceAfter?.dataType || "string"}`,
            nullable: Boolean(change.sourceAfter?.isNullable ?? true),
          },
          isBusinessKey: Boolean(change.sourceAfter?.isPrimaryKey),
          properties: [],
        });
      }
      continue;
    }

    if (change.changeType === "REMOVED_COLUMN") {
      const mappingIndex = findSourceMappingIndex(change.columnName);
      if (mappingIndex >= 0) sourceMappings.splice(mappingIndex, 1);
      if (existingAttrIndex >= 0) attrs.splice(existingAttrIndex, 1);
      continue;
    }

    if (!existingAttr) continue;
    const targetAttr = existingAttr;
    if (!targetAttr.dataType || typeof targetAttr.dataType !== "object") {
      targetAttr.dataType = {};
    }
    if (change.changeType === "PK_CHANGED") {
      targetAttr.isBusinessKey = Boolean(change.sourceAfter?.isPrimaryKey);
    }
    if (change.changeType === "DESCRIPTION_CHANGED") {
      const existingDesc = typeof targetAttr.description === "string" ? targetAttr.description.trim() : "";
      if (!existingDesc) {
        targetAttr.description = change.sourceAfter?.description ?? undefined;
      }
    }
    if (change.changeType === "PROPERTIES_CHANGED") {
      const existing: any[] = Array.isArray(targetAttr.properties) ? targetAttr.properties : [];
      const existingKeys = new Set(existing.map((p: any) => `${p?.property}`.trim()).filter(Boolean));
      const incoming: any[] = Array.isArray(change.sourceAfter?.properties) ? change.sourceAfter.properties : [];
      const toAdd = incoming.filter((p: any) => {
        const key = `${p?.property}`.trim();
        return key && !existingKeys.has(key);
      });
      if (toAdd.length > 0) {
        targetAttr.properties = [...existing, ...toAdd];
      }
    }
  }

  if (sourceEntry) {
    sourceEntry.mapping = sourceMappings;
    sources[sourceIndex] = sourceEntry;
    nextContent.sources = sources;
  }

  nextContent.attributes = attrs.map((attr: any, index: number) => ({
    ...attr,
    ordinalNumber: index + 1,
  }));

  return nextContent;
}
