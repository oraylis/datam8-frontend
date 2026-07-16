import type React from "react";
import type { PropertyAssignment } from "@datam8/types";
import { useCallback, useState } from "react";
import { apiBase } from "../../../../config";
import { readBackendErrorMessage } from "../../../../shared/api/errorMessage";
import type { ModelEntity, TableMetadata } from "../../model-types";
import {
  mapSourceDataTypeToCanonical,
  mergeInheritedDataTypeMappings,
  normalizeFolderPath,
  sanitizeDataType,
  type DataTypeMapping,
} from "../../model-utils";
import { modelLocatorFromRelPath } from "../../locator-utils";
import type { WizardFormValues } from "./schema";
import type { ResolvedWizardDataSource } from "./useWizardBaseData";
import { createModelEntityByRelPath } from "../../../../shared/api/v2Client";
import { useErrorSurface } from "../../../../shared/ui/ErrorSurface";
import { resolveSourceOverride, toSourceOverride } from "./sourceOverride";

type SubmitDeps = {
  modelEntities: ModelEntity[];
  setModelEntities: React.Dispatch<React.SetStateAction<ModelEntity[]>>;
  openModelTab: (relPath: string, title: string) => void;
  focusEntityTab: (relPath: string) => void;
  setActiveWorkTab: (key: string | null) => void;
  setSelectedRelPath: (path: string | null) => void;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  solutionPath?: string;
  dataSources: Array<ResolvedWizardDataSource & { dataTypeMapping?: unknown }>;
  canonicalDataTypes: string[];
};

type WizardAttribute = WizardFormValues["attributes"][number];
type WizardSource = WizardFormValues["sources"][number];
type WizardRelationship = WizardFormValues["relationships"][number];

type MappedAttribute = {
  ordinalNumber: number;
  name: string;
  attributeType: string;
  dataType: ReturnType<typeof sanitizeDataType>;
  isBusinessKey?: boolean;
  dateAdded: string;
  properties?: PropertyAssignment[];
};

type MappedSourceMapping = {
  targetName: string;
  sourceName: string;
  sourceDataType: ReturnType<typeof sanitizeDataType>;
  properties?: PropertyAssignment[];
};

type MappedSource = {
  dataSource?: string;
  sourceAlias?: string;
  sourceLocation?: string | number;
  properties?: PropertyAssignment[];
  mapping?: MappedSourceMapping[] | unknown[];
};

type MappedRelationship = {
  dataSource?: string;
  targetLocation: string | number | undefined;
  alias?: string;
  attributes: Array<{ sourceName?: string; targetName?: string }>;
};

type MappedCreatedAttribute = {
  ordinalNumber: number;
  name: string;
  description?: string;
  attributeType: string;
  dataType: ReturnType<typeof sanitizeDataType>;
  isBusinessKey: boolean;
  dateAdded: string;
  properties: PropertyAssignment[];
};

export function mapInternalAttributesFromEntity(params: {
  attributes: unknown;
  nowIso: string;
}): MappedCreatedAttribute[] {
  const { attributes, nowIso } = params;
  const sourceAttributes = Array.isArray(attributes) ? attributes : [];
  return sourceAttributes.map((attr: any, idx: number) => ({
    ordinalNumber: idx + 1,
    name: typeof attr?.name === "string" ? attr.name : `Attribute${idx + 1}`,
    description: typeof attr?.description === "string" ? attr.description : undefined,
    attributeType: typeof attr?.attributeType === "string" ? attr.attributeType : "Regular",
    dataType: sanitizeDataType(attr?.dataType),
    isBusinessKey: Boolean(attr?.isBusinessKey),
    dateAdded: typeof attr?.dateAdded === "string" ? attr.dateAdded : nowIso,
    properties: Array.isArray(attr?.properties) ? attr.properties : [],
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function toPropertyAssignments(input: unknown): PropertyAssignment[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry): PropertyAssignment | null => {
      if (!isRecord(entry)) return null;
      const property = typeof entry.property === "string" ? entry.property.trim() : "";
      if (!property) return null;
      const value = typeof entry.value === "string" ? entry.value : "";
      return { property, value };
    })
    .filter((entry): entry is PropertyAssignment => entry !== null);
}

function toDataTypeMappings(input: unknown): DataTypeMapping[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry): DataTypeMapping | null => {
      if (!isRecord(entry)) return null;
      const sourceType = typeof entry.sourceType === "string" ? entry.sourceType : null;
      const targetType = typeof entry.targetType === "string" ? entry.targetType : null;
      if (!sourceType || !targetType) return null;
      return { sourceType, targetType };
    })
    .filter((entry): entry is DataTypeMapping => entry !== null);
}

export function mapMetadataColumnToCreatedAttribute(params: {
  column: TableMetadata["columns"][number];
  index: number;
  nowIso: string;
  effectiveMappings: DataTypeMapping[];
  canonicalDataTypes: string[];
}): MappedCreatedAttribute {
  const { column, index, nowIso, effectiveMappings, canonicalDataTypes } = params;
  const sourceDataType = sanitizeDataType({
    type: column.dataType,
    nullable: column.isNullable,
    charLen: column.maxLength,
    precision: column.numericPrecision,
    scale: column.numericScale,
  });
  const dataType = mapSourceDataTypeToCanonical({
    sourceDataType,
    mappings: effectiveMappings,
    canonicalTypes: canonicalDataTypes,
  });

  return {
    ordinalNumber: index + 1,
    name: column.name,
    description: column.description || undefined,
    attributeType: "Regular",
    dataType,
    isBusinessKey: column.isPrimaryKey,
    dateAdded: nowIso,
    properties: column.properties || [],
  };
}

function toMappedSourceColumns(metadata: TableMetadata): MappedSourceMapping[] {
  return metadata.columns.map((col) => {
    const row: MappedSourceMapping = {
      targetName: col.name,
      sourceName: col.name,
      sourceDataType: sanitizeDataType({
        type: col.dataType,
        nullable: col.isNullable,
        charLen: col.maxLength,
        precision: col.numericPrecision,
        scale: col.numericScale,
      }),
    };
    if (Array.isArray(col.properties) && col.properties.length > 0) {
      row.properties = col.properties;
    }
    return row;
  });
}

function toColumnRelationships(input: unknown): TableMetadata["columns"][number]["relationships"] {
  if (!Array.isArray(input)) return undefined;
  const mapped = input
    .map((entry): NonNullable<TableMetadata["columns"][number]["relationships"]>[number] | null => {
      const rec = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      const dataSource = typeof rec?.dataSource === "string" ? rec.dataSource.trim() : "";
      const targetLocation = typeof rec?.targetLocation === "string" ? rec.targetLocation.trim() : "";
      const sourceName = typeof rec?.sourceName === "string" ? rec.sourceName.trim() : "";
      const targetName = typeof rec?.targetName === "string" ? rec.targetName.trim() : "";
      if (!dataSource || !targetLocation || !sourceName || !targetName) return null;
      const alias = typeof rec?.alias === "string" && rec.alias.trim() ? rec.alias.trim() : undefined;
      return alias ? { dataSource, targetLocation, sourceName, targetName, alias } : { dataSource, targetLocation, sourceName, targetName };
    })
    .filter((entry): entry is NonNullable<TableMetadata["columns"][number]["relationships"]>[number] => entry !== null);
  return mapped.length > 0 ? mapped : undefined;
}

function toMappedRelationshipsFromMetadata(metadata: TableMetadata): MappedRelationship[] {
  const grouped = new Map<string, MappedRelationship>();
  metadata.columns.forEach((column) => {
    (column.relationships || []).forEach((relationship) => {
      const key = `${relationship.dataSource}\n${relationship.targetLocation}\n${relationship.alias || ""}`;
      const current =
        grouped.get(key) ||
        {
          dataSource: relationship.dataSource,
          targetLocation: relationship.targetLocation,
          ...(relationship.alias ? { alias: relationship.alias } : {}),
          attributes: [],
        };
      current.attributes.push({
        sourceName: relationship.sourceName || column.name,
        targetName: relationship.targetName,
      });
      grouped.set(key, current);
    });
  });
  return Array.from(grouped.values()).filter((relationship) => relationship.attributes.length > 0);
}

function mapAttribute(attr: WizardAttribute, idx: number, nowIso: string): MappedAttribute {
  const mapped: MappedAttribute = {
    ordinalNumber: idx + 1,
    name: attr.name,
    attributeType: attr.attributeType,
    dataType: sanitizeDataType({
      type: attr.dataType,
      nullable: attr.nullable ?? true,
    }),
    dateAdded: nowIso,
  };
  if (typeof attr.isKey === "boolean") mapped.isBusinessKey = attr.isKey;
  if (Array.isArray(attr.properties) && attr.properties.length > 0) {
    mapped.properties = attr.properties;
  }
  return mapped;
}

function mapRelationship(rel: WizardRelationship, modelEntities: ModelEntity[]): MappedRelationship {
  if (rel.type === "external") {
    const mapped: MappedRelationship = {
      dataSource: rel.dataSource,
      targetLocation: rel.targetLocation,
      attributes: [{ sourceName: rel.sourceAttribute, targetName: rel.targetAttribute }],
    };
    if (rel.alias) mapped.alias = rel.alias;
    return mapped;
  }
  const targetEntity = modelEntities.find((entity) => entity.relPath === rel.targetRelPath);
  return {
    targetLocation: targetEntity?.content?.id,
    attributes: [{ sourceName: rel.sourceAttribute, targetName: rel.targetAttribute }],
  };
}

function parseTableRef(table: string): { schema: string; name: string } {
  let schema = "";
  let tableName = table;
  const bracketMatch = table.match(/^\[(.*?)\]\.\[(.*?)\]$/);
  if (bracketMatch) {
    schema = bracketMatch[1];
    tableName = bracketMatch[2];
  } else if (table.includes(".")) {
    const parts = table.split(".");
    if (parts.length === 2) {
      schema = parts[0].replace(/^\[|\]$/g, "");
      tableName = parts[1].replace(/^\[|\]$/g, "");
    }
  }
  return { schema, name: tableName };
}

function sourceOverrideLookupKeys(tableRef: { schema: string; name: string }): string[] {
  const keys = new Set<string>();
  const schema = `${tableRef.schema || ""}`.trim();
  const name = `${tableRef.name || ""}`.trim();
  if (!name) return [];
  if (schema) {
    keys.add(`[${schema}].[${name}]`);
    keys.add(`${schema}.${name}`);
  }
  keys.add(name);
  return Array.from(keys);
}

export function useWizardSubmit(deps: SubmitDeps) {
  const {
    modelEntities,
    setModelEntities,
    openModelTab,
    focusEntityTab,
    setActiveWorkTab,
    setSelectedRelPath,
    setExpanded,
    solutionPath: _solutionPath,
    dataSources,
    canonicalDataTypes,
  } = deps;
  const { showError, clearError } = useErrorSurface();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchTableMetadata = useCallback(
    async (dataSource: string, table: string): Promise<TableMetadata> => {
      const parsedRef = parseTableRef(table);
      const schema = parsedRef.schema;
      const tableName = parsedRef.name;

      const endpoint = schema
        ? `${apiBase}/sources/${dataSource}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(tableName)}`
        : `${apiBase}/sources/${dataSource}/tables/${encodeURIComponent(tableName)}`;
      const sourceRes = await fetch(endpoint);
      if (!sourceRes.ok) {
        const payload = await sourceRes.json().catch(() => ({}));
        throw new Error(readBackendErrorMessage(payload, `Failed to fetch metadata for ${table}`));
      }
      const payload = (await sourceRes.json()) as { items?: Array<any> };
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return {
        schema,
        name: tableName,
        type: "BASE TABLE",
        description: typeof (payload as any)?.description === "string" ? (payload as any).description : undefined,
        properties: toPropertyAssignments((payload as any)?.properties),
        sourceOverride: toSourceOverride((payload as any)?.sourceOverride),
        columns: items.map((col) => ({
          name: `${col?.name || ""}`,
          ordinal: Number(col?.ordinal || 0),
          dataType: `${col?.dataType || ""}`,
          maxLength: typeof col?.maxLength === "number" ? col.maxLength : null,
          numericPrecision: typeof col?.numericPrecision === "number" ? col.numericPrecision : null,
          numericScale: typeof col?.numbericScale === "number" ? col.numbericScale : null,
          isNullable: Boolean(col?.isNullable),
          isPrimaryKey: Boolean(col?.isPrimaryKey),
          description: typeof col?.description === "string" ? col.description : undefined,
          properties: toPropertyAssignments(col?.properties),
          relationships: toColumnRelationships(col?.relationships),
        })),
      };
    },
    [],
  );

  const submit = useCallback(
    async (values: WizardFormValues, onClose: () => void) => {
      setIsSubmitting(true);
      try {
        const createdEntities: ModelEntity[] = [];
        let firstRelPath = "";

        if (values.creationMode === "manual") {
          const folderPath = normalizeFolderPath(values.folderPath || "");
          if (!folderPath) throw new Error("Folder path is required");

          const nextId =
            modelEntities.length === 0
              ? 1
              : Math.max(...modelEntities.map((entity) => Number(entity.content.id) || 0)) + 1;

          const relPath = `Model/${folderPath}/${values.name}.json`;
          const locator = modelLocatorFromRelPath(relPath);
          firstRelPath = relPath;
          const nowIso = new Date().toISOString();

          const mappedAttributes = (values.attributes || []).map((attr, idx) => mapAttribute(attr, idx, nowIso));

          const mappedSources = (values.sources || [])
            .map((src): MappedSource | null => {
              if (src.type === "internal") {
                const entity = modelEntities.find((candidate) => candidate.relPath === src.internalEntityRelPath);
                if (!entity) return null;
                const internalSource: MappedSource = { sourceLocation: entity.content.id };
                const normalizedProps = Array.isArray(src.properties) ? src.properties : [];
                const normalizedMapping = Array.isArray(src.mapping) ? src.mapping : [];
                if (normalizedProps.length > 0) internalSource.properties = normalizedProps;
                if (normalizedMapping.length > 0) internalSource.mapping = normalizedMapping;
                return internalSource;
              }

              const metadata = (isRecord(src) ? (src.metadata as TableMetadata | undefined) : undefined) || undefined;
              const dsObj = dataSources.find((entry) => entry.name === src.dataSource) || null;
              const isHttp = dsObj?.connectorId === "http-api";
              let formattedLocation: string | number | undefined = src.sourceLocation;
              let mapping: MappedSourceMapping[] = [];
              let sourceDataSource = src.dataSource;

              if (metadata) {
                formattedLocation = isHttp ? src.sourceLocation : `[${metadata.schema}].[${metadata.name}]`;
                mapping = toMappedSourceColumns(metadata);
                const override = resolveSourceOverride({
                  sourceOverride: metadata.sourceOverride,
                  fallbackDataSource: src.dataSource,
                  fallbackLocation: formattedLocation,
                  dataSources,
                });
                sourceDataSource = override.dataSource;
                formattedLocation = override.sourceLocation;
              }

              const externalSource: MappedSource = {
                dataSource: sourceDataSource,
                sourceLocation: formattedLocation,
              };
              if (src.sourceAlias) externalSource.sourceAlias = src.sourceAlias;
              if (Array.isArray(src.properties) && src.properties.length > 0) {
                externalSource.properties = src.properties;
              }
              if (mapping.length > 0) externalSource.mapping = mapping;
              return externalSource;
            })
            .filter((src): src is MappedSource => src !== null);

          const mappedRelationships = (values.relationships || []).map((rel) => mapRelationship(rel, modelEntities));

          createdEntities.push({
            locator,
            relPath,
            name: values.name || "Unknown",
            content: {
              id: nextId,
              name: values.name,
              displayName: values.displayName || values.name,
              description: values.description || "",
              properties: values.properties || [],
              attributes: mappedAttributes,
              sources: mappedSources,
              relationships: mappedRelationships,
              transformations: [],
            },
          });
        } else {
          const selectedSourceKind = values.selectedSourceKind || "external";
          if (selectedSourceKind === "internal") {
            if (!values.selectedInternalEntities || values.selectedInternalEntities.length === 0) {
              throw new Error("No source entities selected");
            }
          } else {
            if (!values.selectedTables || values.selectedTables.length === 0) throw new Error("No tables selected");
            if (!values.selectedSource) throw new Error("Source is required");
          }

          const folderPath = normalizeFolderPath(values.folderPath || "");
          if (!folderPath) throw new Error("Folder path is required");

          let currentMaxId =
            modelEntities.length === 0 ? 0 : Math.max(...modelEntities.map((entity) => Number(entity.content.id) || 0));

          if (selectedSourceKind === "internal") {
            for (const relPathRef of values.selectedInternalEntities || []) {
              const sourceEntity = modelEntities.find((entity) => entity.relPath === relPathRef);
              if (!sourceEntity) continue;

              currentMaxId += 1;
              const sourceId = Number(sourceEntity.content.id);
              const entityName = values.tableRenames?.[relPathRef] || sourceEntity.name;
              const relPath = `Model/${folderPath}/${entityName}.json`;
              const locator = modelLocatorFromRelPath(relPath);
              if (!firstRelPath) firstRelPath = relPath;

              const nowIso = new Date().toISOString();
              const attributes = mapInternalAttributesFromEntity({
                attributes: sourceEntity.content.attributes,
                nowIso,
              });

              const internalSource: MappedSource = {
                sourceLocation: Number.isFinite(sourceId) ? sourceId : sourceEntity.content.id,
              };

              createdEntities.push({
                locator,
                relPath,
                name: entityName,
                content: {
                  id: currentMaxId,
                  name: entityName,
                  displayName: entityName,
                  description:
                    (values.tableDescriptions && values.tableDescriptions[relPathRef]) ||
                    sourceEntity.content.description ||
                    "",
                  properties: (values.tableProperties && values.tableProperties[relPathRef]) || [],
                  attributes,
                  sources: [internalSource],
                  relationships: [],
                  transformations: [],
                },
              });
            }
          } else {
            const selectedSource = values.selectedSource as string;
            const dsObj = dataSources.find((entry) => entry.name === selectedSource) || null;
            const typeMappings = toDataTypeMappings(dsObj?.dataSourceType?.dataTypeMapping);
            const sourceMappings = toDataTypeMappings(dsObj?.dataTypeMapping);
            const inheritedMappings = mergeInheritedDataTypeMappings(typeMappings, sourceMappings);
            const effectiveMappings = [...inheritedMappings, ...sourceMappings];
            let listedOverridesByKey: Record<string, { dataSource?: string; sourceLocation?: string }> | null = null;

            const ensureListedOverrides = async (): Promise<Record<string, { dataSource?: string; sourceLocation?: string }>> => {
              if (listedOverridesByKey) return listedOverridesByKey;
              const res = await fetch(`${apiBase}/sources/${selectedSource}/tables`, { method: "GET" });
              if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                throw new Error(readBackendErrorMessage(payload, "Failed to load tables"));
              }
              const payload = (await res.json()) as { items?: Array<any> };
              const items = Array.isArray(payload?.items) ? payload.items : [];
              const byKey: Record<string, { dataSource?: string; sourceLocation?: string }> = {};
              items.forEach((item) => {
                const override = toSourceOverride(item?.sourceOverride);
                const schema = typeof item?.schema === "string" ? item.schema : "";
                const name = typeof item?.name === "string" ? item.name : "";
                if (!override || !name) return;
                sourceOverrideLookupKeys({ schema, name }).forEach((key) => {
                  byKey[key] = override;
                });
              });
              listedOverridesByKey = byKey;
              return byKey;
            };

            for (const tableName of values.selectedTables || []) {
              currentMaxId += 1;
              const metadata = await fetchTableMetadata(selectedSource, tableName);
              const entityName = values.tableRenames?.[tableName] || metadata.name;
              const relPath = `Model/${folderPath}/${entityName}.json`;
              const locator = modelLocatorFromRelPath(relPath);
              if (!firstRelPath) firstRelPath = relPath;

              const nowIso = new Date().toISOString();
              const attributes = metadata.columns.map((col, idx) =>
                mapMetadataColumnToCreatedAttribute({
                  column: col,
                  index: idx,
                  nowIso,
                  effectiveMappings,
                  canonicalDataTypes,
                }),
              );

              const typeName = (dsObj?.type || "").toLowerCase();
              const isHttp = dsObj?.connectorId === "http-api" || typeName.includes("http") || typeName.includes("api");
              const defaultLocation = isHttp ? tableName : `[${metadata.schema}].[${metadata.name}]`;
              let sourceOverride = values.tableSourceOverrides?.[tableName] || metadata.sourceOverride;
              if (!sourceOverride) {
                const listedOverrides = await ensureListedOverrides();
                const parsedRef = parseTableRef(tableName);
                const lookupKeys = sourceOverrideLookupKeys({
                  schema: parsedRef.schema || metadata.schema,
                  name: parsedRef.name || metadata.name,
                });
                for (const key of lookupKeys) {
                  if (listedOverrides[key]) {
                    sourceOverride = listedOverrides[key];
                    break;
                  }
                }
              }
              const resolvedOverride = resolveSourceOverride({
                sourceOverride,
                fallbackDataSource: selectedSource,
                fallbackLocation: defaultLocation,
                dataSources,
              });
              const sourceDataSource = resolvedOverride.dataSource || selectedSource;
              const formattedLocation = resolvedOverride.sourceLocation || defaultLocation;
              const mapping = toMappedSourceColumns(metadata);

              const source: MappedSource = {
                dataSource: sourceDataSource,
                sourceLocation: formattedLocation,
                mapping,
              };
              const relationships = toMappedRelationshipsFromMetadata(metadata);
              createdEntities.push({
                locator,
                relPath,
                name: entityName,
                content: {
                  id: currentMaxId,
                  name: entityName,
                  displayName: entityName,
                  description:
                    (values.tableDescriptions && values.tableDescriptions[tableName]) ||
                    metadata.description ||
                    "",
                  properties:
                    (values.tableProperties && values.tableProperties[tableName]?.length)
                      ? values.tableProperties[tableName]
                      : (metadata.properties ?? []),
                  attributes,
                  sources: [source],
                  relationships,
                  transformations: [],
                },
              });
            }
          }
        }

        for (const entity of createdEntities) {
          await createModelEntityByRelPath(entity.relPath, entity.content as Record<string, unknown>);
        }

        setModelEntities((prev) => [...prev, ...createdEntities]);

        if (createdEntities.length === 1 && firstRelPath) {
          openModelTab(firstRelPath, createdEntities[0].name);
          focusEntityTab(firstRelPath);
          setActiveWorkTab(`entity:${firstRelPath}`);
          setSelectedRelPath(firstRelPath);
        } else if (createdEntities.length > 0) {
          const folderPath = normalizeFolderPath(values.folderPath || "");
          if (folderPath) {
            setExpanded((prev) => {
              const next = new Set(prev);
              const parts = folderPath.split("/").filter(Boolean);
              let acc = "";
              parts.forEach((part) => {
                acc = acc ? `${acc}/${part}` : part;
                next.add(acc);
              });
              return next;
            });
          }
        }

        clearError("dialog:create-entity-wizard");

        onClose();
      } catch (err: unknown) {
        const description = err instanceof Error ? err.message : "Unknown error";
        showError("dialog:create-entity-wizard", {
          title: "Create failed",
          description,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      canonicalDataTypes,
      dataSources,
      fetchTableMetadata,
      focusEntityTab,
      modelEntities,
      openModelTab,
      setActiveWorkTab,
      clearError,
      setExpanded,
      setModelEntities,
      setSelectedRelPath,
      showError,
    ],
  );

  return { submit, isSubmitting };
}
