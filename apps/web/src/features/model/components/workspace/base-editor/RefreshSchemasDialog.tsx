import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
  Badge,
  Input,
  ScrollArea,
  Alert,
  AlertTitle,
  AlertDescription
} from "@datam8/ui";
import { Loader2, AlertTriangle, ArrowRight, FileText, CheckCircle2, ChevronDown, ChevronRight, Database } from "lucide-react";
import { useSolution } from "../../../../solution/SolutionContext";
import { useModelEditor } from "../../../ModelEditorContext";
import { readBackendErrorMessage } from "../../../../../shared/api/errorMessage";
import { saveModelEntityByRelPath } from "../../../../../shared/api/v2Client";
import { ensureLoaded as ensureConnectorCatalogLoaded, useConnectorCatalog } from "../../../../../shared/connectors/connectorCatalog";
import { normalizeDataTypeForSave } from "../utils/sourceNormalization";
import { MultiItemResponse } from "../../../model-types";
import { SourceField } from "../../../generated-schema-types";
import { ExternalSourceConfigurator } from "../../wizard/SourceRow";
import { buildSourceMetadataEndpoint } from "../../wizard/sourcePreview";
import {
  applyRelationshipChange,
  buildRefreshEntityNameResolver,
  diffRelationships,
  relationshipSummary,
  relationshipsFromSourceFields,
  type RelationshipChange,
  type RelationshipChangeType,
} from "./relationshipRefresh";
import {
  applyColumnSchemaChangesToEntityContent,
  type ColumnSchemaChange,
  type ColumnSchemaChangeType,
} from "./schemaRefreshApply";
import {
  externalSchemaTriState,
  groupExternalSchemaUsages,
  isSchemaChangeSuggested,
  isUsageInitiallySelected,
  isUsageInExternalSchemaScope,
  needsExternalSchemaSourceContext,
  type ExternalSchemaScope,
} from "./externalSchemaScope";

const AUTH_FAILURE_MESSAGE =
  "Authentication failed. Update the Data Source configuration (including secrets) and try again.";

type RefreshSchemasDialogProps = {
  scope?: ExternalSchemaScope;
  dataSourceName?: string;
  dataSource?: {
    name?: string;
    type?: string;
    dataSourceType?: string;
    connectionProperties?: any;
    extendedProperties?: any;
  } | null;
  dataSourceType?: {
    name?: string;
    pluginId?: string;
    extendedProperties?: any;
    connectionProperties?: any;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  browseDataSourceObject?: any;
  browseExistingMappings?: Array<{ source?: string; sourceName?: string; target?: string; targetName?: string }>;
  onBrowseApply?: (table: string, metadata: any) => void;
};

type ExternalSourceUsage = {
  entityRelPath: string;
  entityName: string;
  layer?: string;
  sourceIndex: number;
  dataSource: string;
  sourceAlias?: string;
  sourceLocation: string;
  connectorId?: string;
};

type SchemaChangeType = ColumnSchemaChangeType | RelationshipChangeType;

type ColumnChange = ColumnSchemaChange | RelationshipChange;

type ExternalSourceSchemaDiff = {
  entityRelPath: string;
  entityName: string;
  sourceIndex: number;
  dataSource: string;
  sourceAlias?: string;
  sourceLocation: string;
  changes: ColumnChange[];
  summary: {
    newColumns: number;
    removedColumns: number;
    pkChanges: number;
    typeChanges: number;
    nullableChanges: number;
    descriptionChanges: number;
    propertiesChanges: number;
    relationshipChanges: number;
  };
};

type DiffSelection = {
  entityRelPath: string;
  sourceIndex: number;
  changes: {
    columnName: string;
    changeType: SchemaChangeType;
    applyToEntity: boolean;
  }[];
};

type TriState = boolean | "indeterminate";
type HttpError = Error & { status?: number };

const toHttpError = (message: string, status?: number): HttpError => {
  const err: HttpError = new Error(message);
  err.status = status;
  return err;
};

const STEPS = {
  SELECT: 0,
  PREVIEW: 1,
  APPLYING: 2,
  RESULT: 3,
};

const isRelationshipChange = (change: ColumnChange): change is RelationshipChange =>
  change.changeType === "RELATIONSHIP_ADDED" ||
  change.changeType === "RELATIONSHIP_REMOVED" ||
  change.changeType === "RELATIONSHIP_MAPPING_CHANGED";

export const RefreshSchemasDialog = ({
  scope,
  dataSourceName,
  dataSource,
  dataSourceType,
  isOpen,
  onClose,
  browseDataSourceObject,
  browseExistingMappings = [],
  onBrowseApply,
}: RefreshSchemasDialogProps) => {
  const { solutionPath } = useSolution();
  const {
    baseEntities,
    setModelEntities,
    modelTabs,
    modelEntities,
    setEntityDraft,
    setTabDirty,
  } = useModelEditor();
  const [step, setStep] = useState(STEPS.SELECT);
  const [isLoading, setIsLoading] = useState(false);
  const [usages, setUsages] = useState<ExternalSourceUsage[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<Set<string>>(new Set()); // `${entityRelPath}:${sourceIndex}`
  const [diffs, setDiffs] = useState<ExternalSourceSchemaDiff[]>([]);
  const [selections, setSelections] = useState<DiffSelection[]>([]);
  const [applyResult, setApplyResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyWarning, setDirtyWarning] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());
  const [authErrorHint, setAuthErrorHint] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState({ completed: 0, total: 0 });
  const [scanErrors, setScanErrors] = useState<Record<string, string>>({});
  const [browseSelection, setBrowseSelection] = useState<{
    table: string;
    metadata: any;
    selectedColumns: Set<string>;
  } | null>(null);
  const [removeInvalidMappings, setRemoveInvalidMappings] = useState(false);
  const [collapsedDataSources, setCollapsedDataSources] = useState<Set<string>>(new Set());
  const [collapsedPreviewDataSources, setCollapsedPreviewDataSources] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const initializedScopeRef = useRef<string | null>(null);
  const connectorCatalog = useConnectorCatalog((state) => state.connectors);
  const connectorCatalogKey = connectorCatalog
    .map((connector) => `${connector.id}:${connector.capabilities?.metadata?.getTableMetadata === true}`)
    .sort()
    .join("|");

  const requestedScopeKind = scope?.kind;
  const requestedDataSourceName = scope && scope.kind !== "all" ? scope.dataSourceName : dataSourceName || "";
  const requestedSourceLocation = scope && "sourceLocation" in scope ? scope.sourceLocation : "";
  const requestedEntityRelPath = scope?.kind === "entitySource" ? scope.entityRelPath : "";
  const requestedSourceIndex = scope?.kind === "entitySource" ? scope.sourceIndex : -1;
  const effectiveScope = useMemo<ExternalSchemaScope>(
    () => {
      if (requestedScopeKind === "browseSource" || requestedScopeKind === "browseRelationship") {
        return { kind: requestedScopeKind, dataSourceName: requestedDataSourceName, sourceLocation: requestedSourceLocation };
      }
      if (requestedScopeKind === "dataSource" || (!requestedScopeKind && requestedDataSourceName)) {
        return { kind: "dataSource", dataSourceName: requestedDataSourceName };
      }
      if (requestedScopeKind === "entitySource") {
        return {
          kind: "entitySource",
          dataSourceName: requestedDataSourceName,
          entityRelPath: requestedEntityRelPath,
          sourceIndex: requestedSourceIndex,
        };
      }
      return { kind: "all" };
    },
    [requestedDataSourceName, requestedEntityRelPath, requestedScopeKind, requestedSourceIndex, requestedSourceLocation],
  );

  const configuredDataSources = useMemo(() => {
    const map = new Map<string, any>();
    baseEntities.forEach((entry) => {
      (entry.content?.dataSources || []).forEach((item: any) => {
        const name = `${item?.name || ""}`.trim();
        if (name) map.set(name, item);
      });
    });
    return map;
  }, [baseEntities]);

  const configuredDataSourceTypes = useMemo(() => {
    const map = new Map<string, any>();
    baseEntities.forEach((entry) => {
      (entry.content?.dataSourceTypes || []).forEach((item: any) => {
        const name = `${item?.name || ""}`.trim();
        if (name) map.set(name, item);
      });
    });
    return map;
  }, [baseEntities]);

  const connectorIdFor = useCallback((name: string) => {
    const direct = name === dataSourceName && dataSourceType?.pluginId ? `${dataSourceType.pluginId}`.trim() : "";
    const configured = configuredDataSources.get(name);
    const typeName = `${configured?.type || configured?.dataSourceType || ""}`.trim();
    const connectorId = direct || `${configuredDataSourceTypes.get(typeName)?.pluginId || ""}`.trim();
    const installed = connectorCatalog.find((connector) => connector.id === connectorId);
    return installed?.capabilities?.metadata?.getTableMetadata === true ? connectorId : "";
  }, [configuredDataSourceTypes, configuredDataSources, connectorCatalog, dataSourceName, dataSourceType?.pluginId]);

  useEffect(() => {
    if (isOpen) {
      setBrowseSelection(null);
      setRemoveInvalidMappings(false);
      setCollapsedPreviewDataSources(new Set());
    }
  }, [isOpen, requestedScopeKind, requestedSourceLocation]);

  useEffect(() => {
    if (isOpen) void ensureConnectorCatalogLoaded();
  }, [isOpen]);

  const isAuthFailure = (status?: number, message?: string) => {
    if (status === 401 || status === 403) return true;
    const m = (message || "").toLowerCase();
    return m.includes("auth_failed") || m.includes("authentication") || m.includes("unauthorized") || m.includes("forbidden");
  };

  const loadSourceFields = async (sourceName: string, sourceLocation: string, signal?: AbortSignal): Promise<SourceField[]> => {
    const response = await fetch(buildSourceMetadataEndpoint(sourceName, sourceLocation), { signal });
    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      throw toHttpError(
        readBackendErrorMessage(errPayload, `Failed to load source metadata (${response.status})`),
        response.status,
      );
    }
    const payload = await response.json().catch((e: Error) => {
      throw toHttpError(`Source metadata response was not valid JSON: ${e.message}`, response.status);
    }) as MultiItemResponse<SourceField>;
    return payload.items;
  };

  const computeUsageDiff = (usage: ExternalSourceUsage, fields: SourceField[]) => {
    const entity = modelEntities.find((entry) => entry.relPath === usage.entityRelPath);
    if (!entity) return null;
    const attributes = Array.isArray(entity.content?.attributes) ? entity.content.attributes : [];
    const sourceEntry = Array.isArray(entity.content?.sources)
      ? entity.content.sources[usage.sourceIndex]
      : null;
    const sourceMappings = Array.isArray(sourceEntry?.mapping) ? sourceEntry.mapping : [];
    const byName = new Map<string, any>();
    for (const attr of attributes) {
      const name = `${(attr as any)?.name || ""}`.trim();
      if (name) byName.set(name, attr);
    }
    const sourceMappingBySourceName = new Map<string, any>();
    for (const mapping of sourceMappings) {
      const sourceName = `${mapping?.sourceName || ""}`.trim();
      if (sourceName && !sourceMappingBySourceName.has(sourceName)) {
        sourceMappingBySourceName.set(sourceName, mapping);
      }
    }
    const sourceByName = new Map<string, SourceField>();
    for (const field of fields) {
      sourceByName.set(field.name, field);
    }

    const changes: ColumnChange[] = [];
    for (const [name, src] of sourceByName.entries()) {
      const mapping = sourceMappingBySourceName.get(name);
      const mappingTargetName = `${mapping?.targetName || ""}`.trim();
      const attr = mappingTargetName ? byName.get(mappingTargetName) : byName.get(name);
      const sourceDataTypeBefore =
        mapping?.sourceDataType && typeof mapping.sourceDataType === "object"
          ? mapping.sourceDataType
          : null;
      const sourceDataTypeAfter = normalizeDataTypeForSave({
        type: src?.dataType,
        nullable: src?.isNullable,
        charLen: src?.maxLength,
        precision: src?.numericPrecision,
        scale: src?.numericScale,
      });
      const sourceTypeBefore = `${sourceDataTypeBefore?.type || ""}`.toLowerCase();
      const sourceTypeAfter = `${sourceDataTypeAfter?.type || ""}`.toLowerCase();
      const sourceNullableBefore = typeof sourceDataTypeBefore?.nullable === "boolean" ? sourceDataTypeBefore.nullable : null;
      const sourceNullableAfter = typeof sourceDataTypeAfter?.nullable === "boolean" ? sourceDataTypeAfter.nullable : null;
      const targetPk = Boolean((attr as any)?.isBusinessKey);
      const sourcePk = Boolean(src?.isPrimaryKey);
      if (sourceTypeBefore && sourceTypeAfter && sourceTypeBefore !== sourceTypeAfter) {
        changes.push({
          changeType: "TYPE_CHANGED",
          columnName: name,
          sourceBefore: { sourceDataType: sourceDataTypeBefore },
          sourceAfter: { ...src, sourceDataType: sourceDataTypeAfter },
          entityAttributeName: mappingTargetName || undefined,
          applyToEntitySuggested: true,
        });
      }
      if (
        sourceNullableBefore !== null &&
        sourceNullableAfter !== null &&
        sourceNullableBefore !== sourceNullableAfter
      ) {
        changes.push({
          changeType: "NULLABILITY_CHANGED",
          columnName: name,
          sourceBefore: { sourceDataType: sourceDataTypeBefore },
          sourceAfter: { ...src, sourceDataType: sourceDataTypeAfter },
          entityAttributeName: mappingTargetName || undefined,
          applyToEntitySuggested: true,
        });
      }

      if (!mapping) {
        changes.push({
          changeType: "NEW_COLUMN",
          columnName: name,
          sourceAfter: src,
          applyToEntitySuggested: true,
        });
        continue;
      }

      if (attr && targetPk !== sourcePk) {
        changes.push({
          changeType: "PK_CHANGED",
          columnName: name,
          sourceBefore: attr,
          sourceAfter: src,
          entityAttributeName: mappingTargetName || undefined,
          applyToEntitySuggested: true,
        });
      }

      // Description change detection
      const descBefore = attr && typeof attr.description === "string" ? attr.description : undefined;
      const descAfter = typeof src?.description === "string" ? src.description : undefined;
      if (descAfter !== undefined && descBefore !== descAfter) {
        changes.push({
          changeType: "DESCRIPTION_CHANGED",
          columnName: name,
          sourceBefore: { description: descBefore },
          sourceAfter: { ...src, description: descAfter },
          entityAttributeName: mappingTargetName || undefined,
          applyToEntitySuggested: true,
        });
      }

      // Properties change detection — only flag additions from source; never signal removal
      const propsBefore: any[] = attr && Array.isArray(attr.properties) ? attr.properties : [];
      const propsAfter: any[] = Array.isArray(src?.properties) ? src.properties : [];
      if (propsAfter.length > 0) {
        const existingKeys = new Set(propsBefore.map((p: any) => `${p?.property}`.trim()).filter(Boolean));
        const newProps = propsAfter.filter((p: any) => {
          const key = `${p?.property}`.trim();
          return key && !existingKeys.has(key);
        });
        if (newProps.length > 0) {
          changes.push({
            changeType: "PROPERTIES_CHANGED",
            columnName: name,
            sourceBefore: { properties: propsBefore },
            sourceAfter: { ...src, properties: propsAfter },
            entityAttributeName: mappingTargetName || undefined,
            applyToEntitySuggested: true,
          });
        }
      }
    }
    for (const mapping of sourceMappings) {
      const sourceName = `${mapping?.sourceName || ""}`.trim();
      if (!sourceName) continue;
      if (!sourceByName.has(sourceName)) {
        const mappingTargetName = `${mapping?.targetName || ""}`.trim();
        const attr = mappingTargetName ? byName.get(mappingTargetName) : null;
        changes.push({
          changeType: "REMOVED_COLUMN",
          columnName: sourceName,
          sourceBefore: {
            sourceDataType: mapping?.sourceDataType,
            dataType: mapping?.sourceDataType?.type,
            isNullable: mapping?.sourceDataType?.nullable,
            isPrimaryKey: attr ? Boolean((attr as any)?.isBusinessKey) : undefined,
          },
          entityAttributeName: mappingTargetName || undefined,
          applyToEntitySuggested: false,
        });
      }
    }

    const resolveInternalTarget = buildRefreshEntityNameResolver(modelEntities);
    const relationshipChanges = diffRelationships(
      entity.content?.relationships,
      relationshipsFromSourceFields(fields as any, resolveInternalTarget),
    );
    changes.push(...relationshipChanges);

    return {
      entityRelPath: usage.entityRelPath,
      entityName: usage.entityName,
      sourceIndex: usage.sourceIndex,
      dataSource: usage.dataSource,
      sourceAlias: usage.sourceAlias,
      sourceLocation: usage.sourceLocation,
      changes,
      summary: {
        newColumns: changes.filter((c) => c.changeType === "NEW_COLUMN").length,
        removedColumns: changes.filter((c) => c.changeType === "REMOVED_COLUMN").length,
        pkChanges: changes.filter((c) => c.changeType === "PK_CHANGED").length,
        typeChanges: changes.filter((c) => c.changeType === "TYPE_CHANGED").length,
        nullableChanges: changes.filter((c) => c.changeType === "NULLABILITY_CHANGED").length,
        descriptionChanges: changes.filter((c) => c.changeType === "DESCRIPTION_CHANGED").length,
        propertiesChanges: changes.filter((c) => c.changeType === "PROPERTIES_CHANGED").length,
        relationshipChanges: changes.filter((c) => isRelationshipChange(c)).length,
      },
    } as ExternalSourceSchemaDiff;
  };

  // Load Usages on Open
  useEffect(() => {
    if (!isOpen) {
      initializedScopeRef.current = null;
      return;
    }
    const initializationKey = `${effectiveScope.kind}:${effectiveScope.kind === "all" ? "" : effectiveScope.dataSourceName}:${"sourceLocation" in effectiveScope ? effectiveScope.sourceLocation : ""}:${effectiveScope.kind === "entitySource" ? `${effectiveScope.entityRelPath}:${effectiveScope.sourceIndex}` : ""}:${connectorCatalogKey}`;
    if (initializedScopeRef.current === initializationKey) return;
    initializedScopeRef.current = initializationKey;
    if (isOpen) {
      setStep(STEPS.SELECT);
      setIsLoading(true);
      setError(null);
      setAuthErrorHint(null);
      setDirtyWarning(null);
      setCollapsedDataSources(new Set());
      try {
        const nextUsages: ExternalSourceUsage[] = [];
        modelEntities.forEach((entity) => {
          const sources = Array.isArray(entity.content?.sources) ? entity.content.sources : [];
          sources.forEach((source: any, sourceIndex: number) => {
            const ds = `${source?.dataSource || ""}`.trim();
            if (!ds) return;
            if (!isUsageInExternalSchemaScope(effectiveScope, {
              dataSource: ds,
              entityRelPath: entity.relPath,
              sourceIndex,
            })) return;
            nextUsages.push({
              entityRelPath: entity.relPath,
              entityName: entity.name,
              sourceIndex,
              dataSource: ds,
              sourceAlias: typeof source?.sourceAlias === "string" ? source.sourceAlias : undefined,
              sourceLocation: `${source?.sourceLocation || ""}`,
              connectorId: connectorIdFor(ds),
            });
          });
        });
        setUsages(nextUsages);
        setSelectedUsages(new Set(
          nextUsages
            .filter((usage) => usage.connectorId && isUsageInitiallySelected(effectiveScope, usage))
            .map((u) => `${u.entityRelPath}:${u.sourceIndex}`),
        ));
      } catch (err: any) {
        console.error("[DataM8] Failed to inspect source usages:", err);
        setError(err?.message || "Failed to inspect source usages");
      } finally {
        setIsLoading(false);
      }
    }
  }, [connectorCatalogKey, connectorIdFor, effectiveScope, isOpen, modelEntities, solutionPath]);

  const toggleUsage = (key: string) => {
    const next = new Set(selectedUsages);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedUsages(next);
  };

  const handleAuthFailure = (status?: number, message?: string) => {
    if (isAuthFailure(status, message)) {
      setError(AUTH_FAILURE_MESSAGE);
      setAuthErrorHint(AUTH_FAILURE_MESSAGE);
      return true;
    }
    setAuthErrorHint(null);
    return false;
  };

  const errorMessage = error || authErrorHint;

  const handleScan = async () => {
    setIsLoading(true);
    setError(null);
    setAuthErrorHint(null);
    setDirtyWarning(null);

    // Check for dirty entities among selected
    const usagesToScan = usages.filter((u) => selectedUsages.has(`${u.entityRelPath}:${u.sourceIndex}`));

    const dirtyEntities = usagesToScan.filter(u =>
      modelTabs.some(t => t.relPath === u.entityRelPath && t.dirty)
    );

    if (dirtyEntities.length > 0) {
      setDirtyWarning(`${dirtyEntities.length} selected entity(s) have unsaved changes and will be locked during apply. Save them or exclude them before applying.`);
    }

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setScanProgress({ completed: 0, total: usagesToScan.length });
      setScanErrors({});
      const fetchedDiffs: ExternalSourceSchemaDiff[] = [];
      const failures: Record<string, string> = {};
      const groups = Array.from(
        usagesToScan.reduce((map, usage) => {
          const key = `${usage.dataSource}\n${usage.sourceLocation}`;
          const group = map.get(key) || { key, usages: [] as ExternalSourceUsage[] };
          group.usages.push(usage);
          map.set(key, group);
          return map;
        }, new Map<string, { key: string; usages: ExternalSourceUsage[] }>()).values(),
      );
      const metadataByKey = new Map<string, SourceField[]>();
      const metadataFailures = new Map<string, string>();
      let nextGroup = 0;
      const scanWorker = async () => {
        while (nextGroup < groups.length) {
          const group = groups[nextGroup++];
          const firstUsage = group.usages[0];
          if (!firstUsage) continue;
          try {
            const fields = await loadSourceFields(firstUsage.dataSource, firstUsage.sourceLocation, controller.signal);
            metadataByKey.set(group.key, fields);
          } catch (err: any) {
            if (err?.name === "AbortError") throw err;
            metadataFailures.set(group.key, err?.message || "Failed to scan source metadata");
          } finally {
            setScanProgress((previous) => ({ ...previous, completed: previous.completed + group.usages.length }));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, groups.length) }, () => scanWorker()));
      for (const usage of usagesToScan) {
        const usageKey = `${usage.entityRelPath}:${usage.sourceIndex}`;
        const metadataKey = `${usage.dataSource}\n${usage.sourceLocation}`;
        const metadataError = metadataFailures.get(metadataKey);
        if (metadataError) {
          failures[usageKey] = metadataError;
          continue;
        }
        const fields = metadataByKey.get(metadataKey);
        if (!fields) {
          failures[usageKey] = "Failed to scan source metadata";
          continue;
        }
        const diff = computeUsageDiff(usage, fields);
        if (diff) fetchedDiffs.push(diff);
      }
      setScanErrors(failures);
      setDiffs(fetchedDiffs);

      const initialSelections: DiffSelection[] = fetchedDiffs.map((diff) => ({
        entityRelPath: diff.entityRelPath,
        sourceIndex: diff.sourceIndex,
        changes: diff.changes.map((c) => ({
          columnName: c.columnName,
          changeType: c.changeType,
          applyToEntity: isSchemaChangeSuggested(c.changeType),
        })),
      }));
      setSelections(initialSelections);
      const initialExpanded = new Set(
        fetchedDiffs
          .slice(0, fetchedDiffs.length <= 3 ? fetchedDiffs.length : 1)
          .map((d) => `${d.entityRelPath}:${d.sourceIndex}`),
      );
      setExpandedTables(initialExpanded);
      setExpandedColumns(new Set());
      setCollapsedPreviewDataSources(new Set());

      setStep(STEPS.PREVIEW);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[DataM8] Schema scan failed:", err);
      const status = err?.status;
      const message = err?.message || "Failed to scan schemas";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  };

  const diffKey = (entityRelPath: string, sourceIndex: number) => `${entityRelPath}:${sourceIndex}`;

  const selectionByKey = useMemo(() => {
    const map = new Map<string, DiffSelection>();
    selections.forEach((s) => map.set(diffKey(s.entityRelPath, s.sourceIndex), s));
    return map;
  }, [selections]);

  const selectionStats = useMemo(() => {
    let total = 0;
    let selected = 0;
    for (const sel of selections) {
      for (const c of sel.changes) {
        total += 1;
        if (c.applyToEntity) selected += 1;
      }
    }
    return { total, selected };
  }, [selections]);

  const setSelectionForDiff = (
    entityRelPath: string,
    sourceIndex: number,
    updater: (sel: DiffSelection) => DiffSelection,
  ) => {
    setSelections((prev) =>
      prev.map((sel) =>
        sel.entityRelPath === entityRelPath && sel.sourceIndex === sourceIndex ? updater(sel) : sel,
      ),
    );
  };

  const toggleChangeSelection = (entityRelPath: string, sourceIndex: number, columnName: string, checked: boolean) => {
    setSelectionForDiff(entityRelPath, sourceIndex, (sel) => ({
      ...sel,
      changes: sel.changes.map((c) => (c.columnName === columnName ? { ...c, applyToEntity: checked } : c)),
    }));
  };

  const toggleChangeTypeSelection = (
    entityRelPath: string,
    sourceIndex: number,
    columnName: string,
    changeType: SchemaChangeType,
    checked: boolean,
  ) => {
    setSelectionForDiff(entityRelPath, sourceIndex, (sel) => ({
      ...sel,
      changes: sel.changes.map((c) =>
        c.columnName === columnName && c.changeType === changeType ? { ...c, applyToEntity: checked } : c,
      ),
    }));
  };

  const toggleTableSelection = (entityRelPath: string, sourceIndex: number, checked: boolean) => {
    setSelectionForDiff(entityRelPath, sourceIndex, (sel) => ({
      ...sel,
      changes: sel.changes.map((c) => ({ ...c, applyToEntity: checked })),
    }));
  };

  const toggleDataSourceSelection = (sourceDiffs: ExternalSourceSchemaDiff[], checked: boolean) => {
    const keys = new Set(sourceDiffs.map((diff) => diffKey(diff.entityRelPath, diff.sourceIndex)));
    setSelections((prev) => prev.map((sel) => (
      keys.has(diffKey(sel.entityRelPath, sel.sourceIndex))
        ? { ...sel, changes: sel.changes.map((change) => ({ ...change, applyToEntity: checked })) }
        : sel
    )));
  };

  const setAllSelected = (checked: boolean) => {
    setSelections((prev) =>
      prev.map((sel) => ({
        ...sel,
        changes: sel.changes.map((c) => ({ ...c, applyToEntity: checked })),
      })),
    );
  };

  const formatType = (dt: any): string => {
    const raw = dt && typeof dt === "object" ? dt : {};
    const type = typeof raw.type === "string" ? raw.type : typeof dt === "string" ? dt : "unknown";
    const charLen = typeof raw.charLen === "number" ? raw.charLen : undefined;
    const precision = typeof raw.precision === "number" ? raw.precision : undefined;
    const scale = typeof raw.scale === "number" ? raw.scale : undefined;

    if (precision !== undefined) return `${type}(${precision}${scale !== undefined ? `,${scale}` : ""})`;
    if (charLen !== undefined) return `${type}(${charLen})`;
    return type;
  };

  const formatTypeWithDetails = (dt: any): string => {
    if (!dt || typeof dt !== "object") return formatType(dt);
    const nullable =
      typeof dt.nullable === "boolean" ? (dt.nullable ? "nullable" : "not null") : undefined;
    return [formatType(dt), nullable].filter(Boolean).join(" | ");
  };

  const renderChangeBadge = (type: SchemaChangeType) => {
    switch (type) {
      case "RELATIONSHIP_ADDED":
        return (
          <Badge variant="outline" className="border-primary/35 bg-primary/12 text-foreground">
            Rel +
          </Badge>
        );
      case "RELATIONSHIP_REMOVED":
        return (
          <Badge variant="outline" className="border-destructive/38 bg-destructive/14 text-destructive">
            Rel -
          </Badge>
        );
      case "RELATIONSHIP_MAPPING_CHANGED":
        return (
          <Badge variant="outline" className="border-border/70 bg-card/72 text-foreground">
            Rel map
          </Badge>
        );
      case "NEW_COLUMN":
        return (
          <Badge variant="outline" className="border-primary/35 bg-primary/12 text-foreground">
            New
          </Badge>
        );
      case "REMOVED_COLUMN":
        return (
          <Badge variant="outline" className="border-destructive/38 bg-destructive/14 text-destructive">
            Removed
          </Badge>
        );
      case "TYPE_CHANGED":
        return (
          <Badge variant="outline" className="border-border/70 bg-card/72 text-foreground">
            Type
          </Badge>
        );
      case "NULLABILITY_CHANGED":
        return (
          <Badge variant="outline" className="border-border/70 bg-card/72 text-foreground">
            Nullable
          </Badge>
        );
      case "PK_CHANGED":
        return (
          <Badge variant="outline" className="border-border/70 bg-card/72 text-foreground">
            PK
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const renderChangeSummary = (change: ColumnChange) => {
    const before = change.sourceBefore;
    const after = change.sourceAfter;
    switch (change.changeType) {
      case "RELATIONSHIP_ADDED":
        return <span>New relationship: {relationshipSummary(after)}</span>;
      case "RELATIONSHIP_REMOVED":
        return <span>Removed relationship: {relationshipSummary(before)}</span>;
      case "RELATIONSHIP_MAPPING_CHANGED":
        return (
          <span>
            Relationship mapping:{" "}
            <span className="line-through text-muted-foreground mr-2">{relationshipSummary(before)}</span>
            <ArrowRight className="inline w-3 h-3 mr-2 text-muted-foreground" />
            <span>{relationshipSummary(after)}</span>
          </span>
        );
      case "NEW_COLUMN":
        return (
          <span>
            New column: <span className="font-mono">{formatTypeWithDetails(after?.dataType)}</span>
            {typeof after?.isPrimaryKey === "boolean" ? (
              <span className="text-muted-foreground"> | {after.isPrimaryKey ? "PK" : "not PK"}</span>
            ) : null}
          </span>
        );
      case "REMOVED_COLUMN":
        return (
          <span>
            Removed column: <span className="font-mono">{formatTypeWithDetails(before?.dataType)}</span>
          </span>
        );
      case "TYPE_CHANGED":
        return (
          <span>
            Source type:{" "}
            <span className="font-mono line-through text-muted-foreground mr-2">
              {formatType(before?.sourceDataType?.type || before?.dataType)}
            </span>
            <ArrowRight className="inline w-3 h-3 mr-2 text-muted-foreground" />
            <span className="font-mono">{formatType(after?.sourceDataType?.type || after?.dataType)}</span>
          </span>
        );
      case "NULLABILITY_CHANGED":
        return (
          <span>
            Source nullable:{" "}
            <span className="font-mono line-through text-muted-foreground mr-2">
              {(before?.sourceDataType?.nullable ?? before?.dataType?.nullable) ? "nullable" : "not null"}
            </span>
            <ArrowRight className="inline w-3 h-3 mr-2 text-muted-foreground" />
            <span className="font-mono">
              {(after?.sourceDataType?.nullable ?? after?.isNullable ?? after?.dataType?.nullable) ? "nullable" : "not null"}
            </span>
          </span>
        );
      case "PK_CHANGED":
        return (
          <span>
            PK:{" "}
            <span className="font-mono line-through text-muted-foreground mr-2">
              {before?.isPrimaryKey ? "PK" : "not PK"}
            </span>
            <ArrowRight className="inline w-3 h-3 mr-2 text-muted-foreground" />
            <span className="font-mono">{after?.isPrimaryKey ? "PK" : "not PK"}</span>
          </span>
        );
      default:
        return <span>{change.changeType}</span>;
    }
  };

  const getColumnGroups = (diff: ExternalSourceSchemaDiff) => {
    const grouped = new Map<string, ColumnChange[]>();
    diff.changes.forEach((c) => {
      const list = grouped.get(c.columnName) || [];
      list.push(c);
      grouped.set(c.columnName, list);
    });
    return Array.from(grouped.entries())
      .map(([columnName, changes]) => ({ columnName, changes }))
      .sort((a, b) => a.columnName.localeCompare(b.columnName));
  };

  const handleApply = async (applyAll = false, onlyRelPaths?: Set<string>) => {
    const hasDestructiveChanges = diffs.some((diff) => diff.changes.some((change) =>
      change.changeType === "REMOVED_COLUMN" || change.changeType === "RELATIONSHIP_REMOVED",
    ));
    if (applyAll && hasDestructiveChanges && !window.confirm("Apply all changes, including removals?")) return;

    setIsLoading(true);
    setError(null);
    setAuthErrorHint(null);
    try {
      const selectionMap = new Map<string, DiffSelection>(
        selections.map((sel) => [`${sel.entityRelPath}:${sel.sourceIndex}`, sel] as const),
      );
      const nextByEntity = new Map<string, any>();

      for (const diff of diffs) {
        if (onlyRelPaths && !onlyRelPaths.has(diff.entityRelPath)) continue;
        const key = `${diff.entityRelPath}:${diff.sourceIndex}`;
        const selection = selectionMap.get(key);
        if (!selection) continue;
        const selectedKeys = new Set(
          selection.changes
            .filter((entry) => applyAll || entry.applyToEntity)
            .map((entry) => `${entry.columnName}::${entry.changeType}`),
        );
        if (!selectedKeys.size) continue;

        const current = modelEntities.find((entity) => entity.relPath === diff.entityRelPath);
        if (!current) continue;
        const nextContent = nextByEntity.get(diff.entityRelPath) || structuredClone(current.content || {});
        const columnChanges: ColumnSchemaChange[] = [];

        for (const change of diff.changes) {
          const marker = `${change.columnName}::${change.changeType}`;
          if (!selectedKeys.has(marker)) continue;
          if (isRelationshipChange(change)) {
            nextContent.relationships = applyRelationshipChange(nextContent.relationships, change);
            continue;
          }
          columnChanges.push(change);
        }

        applyColumnSchemaChangesToEntityContent(nextContent, diff.sourceIndex, columnChanges, selectedKeys);
        nextByEntity.set(diff.entityRelPath, nextContent);
      }

      const dirtyRelPaths = new Set(modelTabs.filter((tab) => tab.dirty).map((tab) => tab.relPath));
      const blocked = Array.from(nextByEntity.keys()).filter((relPath) => dirtyRelPaths.has(relPath));
      if (blocked.length) {
        setError(`${blocked.length} selected entity(s) have unsaved changes. Save them or exclude them before applying.`);
        return;
      }

      const updatedEntities: Array<{ entityRelPath: string; content: any }> = [];
      const failures: Array<{ entityRelPath: string; message: string }> = [];
      for (const [entityRelPath, content] of nextByEntity) {
        try {
          await saveModelEntityByRelPath(entityRelPath, content);
          updatedEntities.push({ entityRelPath, content });
          setEntityDraft(entityRelPath, null);
          setTabDirty(entityRelPath, "entity", false);
        } catch (err) {
          failures.push({ entityRelPath, message: err instanceof Error ? err.message : "Save failed" });
        }
      }

      if (updatedEntities.length) {
        setModelEntities((prev) =>
          prev.map((entity) => {
            const updated = updatedEntities.find((entry) => entry.entityRelPath === entity.relPath);
            return updated ? { ...entity, content: updated.content } : entity;
          }),
        );
      }

      setApplyResult({ updatedEntities, failures });
      setStep(STEPS.RESULT);
    } catch (err: any) {
      console.error("[DataM8] Failed to apply schema changes:", err);
      const status = err?.status;
      const message = err?.message || "Failed to apply changes";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const usageGroups = useMemo(() => {
    return groupExternalSchemaUsages(usages);
  }, [usages]);

  const renderSelectStep = () => (
    <div className="flex flex-col gap-4 h-[400px]">
      <div className="text-sm text-muted-foreground">
        Select the external sources to scan. Sources are grouped by Data Source; exclusions apply only to this run.
      </div>

      {dirtyWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unsaved Changes</AlertTitle>
          <AlertDescription>{dirtyWarning}</AlertDescription>
        </Alert>
      )}

      <ScrollArea className="codex-popup-scroll flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedUsages.size === usages.filter((usage) => usage.connectorId).length && selectedUsages.size > 0}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedUsages(new Set(usages.filter((u) => u.connectorId).map(u => `${u.entityRelPath}:${u.sourceIndex}`)));
                    else setSelectedUsages(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Source Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageGroups.map(([sourceName, sourceUsages]) => {
              const eligible = sourceUsages.filter((usage) => usage.connectorId);
              const selected = eligible.filter((usage) => selectedUsages.has(`${usage.entityRelPath}:${usage.sourceIndex}`));
              const state: TriState = selected.length === 0 ? false : selected.length === eligible.length ? true : "indeterminate";
              const isExpanded = !collapsedDataSources.has(sourceName);
              const groupLabel = `${sourceName}, ${sourceUsages.length} source${sourceUsages.length === 1 ? "" : "s"}`;
              return (
                <React.Fragment key={sourceName}>
                  <TableRow className="border-y border-primary/20 bg-primary/[0.07] hover:bg-primary/[0.11] dark:bg-primary/[0.10] dark:hover:bg-primary/[0.15]">
                    <TableCell colSpan={3} className="p-0">
                      <div className="flex min-h-11 items-center gap-3 px-4">
                      <Checkbox
                        checked={state}
                        disabled={!eligible.length}
                        aria-label={`Select all sources for ${sourceName}`}
                        onCheckedChange={(checked) => setSelectedUsages((previous) => {
                          const next = new Set(previous);
                          eligible.forEach((usage) => {
                            const key = `${usage.entityRelPath}:${usage.sourceIndex}`;
                            if (checked === true) next.add(key); else next.delete(key);
                          });
                          return next;
                        })}
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} data source ${groupLabel}`}
                        onClick={() => setCollapsedDataSources((previous) => {
                          const next = new Set(previous);
                          if (next.has(sourceName)) next.delete(sourceName); else next.add(sourceName);
                          return next;
                        })}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <Database className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="truncate">{sourceName}</span>
                        <Badge variant="outline" className="bg-background/60 font-normal">
                          {sourceUsages.length} source{sourceUsages.length === 1 ? "" : "s"}
                        </Badge>
                        {!eligible.length ? <Badge variant="destructive">No connector linked</Badge> : null}
                      </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && sourceUsages.map((usage) => {
                    const key = `${usage.entityRelPath}:${usage.sourceIndex}`;
                    const isDirty = modelTabs.some((tab) => tab.relPath === usage.entityRelPath && tab.dirty);
                    return (
                      <TableRow key={key}>
                        <TableCell className="pl-8">
                          <Checkbox
                            checked={selectedUsages.has(key)}
                            disabled={!usage.connectorId}
                            onCheckedChange={() => toggleUsage(key)}
                          />
                        </TableCell>
                        <TableCell className="pl-2">
                          <div className="font-medium flex items-center gap-2">
                            {usage.entityName}
                            {isDirty ? <Badge variant="secondary" className="text-[10px] h-4">Dirty</Badge> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{usage.layer || usage.entityRelPath}</div>
                        </TableCell>
                        <TableCell className="text-sm font-mono">{usage.sourceLocation}</TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
            })}
            {usages.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center p-4 muted">No usages found for this data source.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );

  const filteredDiffs = useMemo(() => {
    const needle = previewFilter.trim().toLowerCase();
    const filtered = needle ? diffs.filter((diff) => {
      const header = `${diff.entityName} ${diff.sourceAlias || ""} ${diff.sourceLocation}`.toLowerCase();
      if (header.includes(needle)) return true;
      return diff.changes.some((c) => (c.columnName || "").toLowerCase().includes(needle));
    }) : diffs;
    return [...filtered].sort((left, right) =>
      left.dataSource.localeCompare(right.dataSource) || left.entityName.localeCompare(right.entityName),
    );
  }, [diffs, previewFilter]);

  const filteredDiffGroups = useMemo(() => groupExternalSchemaUsages(filteredDiffs), [filteredDiffs]);

  const allDiffsByDataSource = useMemo(() => {
    return new Map(groupExternalSchemaUsages(diffs));
  }, [diffs]);

  const renderPreviewStep = () => (
    <div className="schema-review flex min-w-0 flex-col gap-3 h-[520px] max-h-[calc(90vh-10rem)] overflow-hidden">
      <div className="flex min-w-0 flex-col gap-2">
        {Object.keys(scanErrors).length ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{Object.keys(scanErrors).length} source scan(s) failed</AlertTitle>
            <AlertDescription>Successful results remain available. Go back and scan again to retry failed sources.</AlertDescription>
          </Alert>
        ) : null}
        <div className="schema-review__toolbar flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Badge variant="outline">{diffs.reduce((acc, d) => acc + d.changes.length, 0)} changes</Badge>
            <Badge variant="outline">{selectionStats.selected}/{selectionStats.total} selected</Badge>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
            <Input
              value={previewFilter}
              onChange={(e) => setPreviewFilter(e.target.value)}
              placeholder="Filter tables / columns..."
              className="h-8 min-w-[12rem] max-w-64 flex-1 sm:flex-none"
            />
            <Button size="sm" variant="ghost" onClick={() => setAllSelected(true)} disabled={!selectionStats.total}>
              Select all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAllSelected(false)} disabled={!selectionStats.total}>
              Deselect all
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              setCollapsedPreviewDataSources(new Set());
              setExpandedTables(new Set(filteredDiffs.map((d) => diffKey(d.entityRelPath, d.sourceIndex))));
            }}
            disabled={!filteredDiffs.length}
          >
            Expand all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              setCollapsedPreviewDataSources(new Set(filteredDiffGroups.map(([sourceName]) => sourceName)));
              setExpandedTables(new Set());
            }}
            disabled={!filteredDiffs.length}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <ScrollArea className="schema-review__scroll min-w-0 flex-1 pr-3">
        {filteredDiffs.length === 0 ? (
          diffs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckCircle2 className="mb-2 h-12 w-12 text-primary" />
              <div>No schema changes detected.</div>
              <div className="text-xs">Your mappings are up to date.</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div>No matching tables/columns.</div>
            </div>
          )
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {filteredDiffGroups.map(([sourceName, visibleSourceDiffs]) => {
              const sourceDiffs = allDiffsByDataSource.get(sourceName) || visibleSourceDiffs;
              const groupFlags = sourceDiffs.flatMap((diff) =>
                selectionByKey.get(diffKey(diff.entityRelPath, diff.sourceIndex))?.changes.map((change) => change.applyToEntity) || [],
              );
              const groupSelected = groupFlags.filter(Boolean).length;
              const groupState = externalSchemaTriState(groupFlags);
              const isGroupExpanded = !collapsedPreviewDataSources.has(sourceName);
              const groupLabel = `${sourceName}, ${sourceDiffs.length} source${sourceDiffs.length === 1 ? "" : "s"}`;

              return (
                <section
                  key={sourceName}
                  className="schema-review__group min-w-0 overflow-hidden rounded-xl border border-border/80"
                  data-testid="schema-review-group"
                >
                  <div className="flex min-w-0 items-center gap-3 border-y border-primary/20 bg-primary/[0.07] px-4 py-2.5 dark:bg-primary/[0.10]">
                    <Checkbox
                      checked={groupState}
                      aria-label={`Select all changes for ${sourceName}`}
                      onCheckedChange={(checked) => toggleDataSourceSelection(sourceDiffs, checked === true)}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-expanded={isGroupExpanded}
                      aria-label={`${isGroupExpanded ? "Collapse" : "Expand"} review group ${groupLabel}`}
                      onClick={() => setCollapsedPreviewDataSources((previous) => {
                        const next = new Set(previous);
                        if (next.has(sourceName)) next.delete(sourceName); else next.add(sourceName);
                        return next;
                      })}
                    >
                      {isGroupExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <Database className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{sourceName}</span>
                      <Badge variant="outline" className="shrink-0 bg-background/60 font-normal">
                        {sourceDiffs.length} source{sourceDiffs.length === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline" className="ml-auto shrink-0 bg-background/60 font-normal">
                        {groupSelected}/{groupFlags.length} selected
                      </Badge>
                    </button>
                  </div>

                  {isGroupExpanded ? (
                    <div className="min-w-0 divide-y divide-border/70">
                      {visibleSourceDiffs.map((diff) => {
                        const key = diffKey(diff.entityRelPath, diff.sourceIndex);
                        const isExpanded = expandedTables.has(key);
                        const sel = selectionByKey.get(key);
                        const diffApplyState = externalSchemaTriState(sel?.changes.map((c) => c.applyToEntity) || []);
                        const diffSelected = sel?.changes.filter((c) => c.applyToEntity).length || 0;
                        const diffTotal = sel?.changes.length || 0;
                        const changedCount =
                          (diff.summary?.typeChanges || 0) +
                          (diff.summary?.nullableChanges || 0) +
                          (diff.summary?.pkChanges || 0);
                        const columnGroups = getColumnGroups(diff);
                        const showSourceContextInHeader = needsExternalSchemaSourceContext(diff, sourceDiffs);
                        const sourceContext = `${diff.sourceAlias || diff.sourceLocation || ""}`.trim();

                        return (
                          <div key={key} className="schema-review__entity min-w-0 overflow-hidden" data-testid="schema-review-entity">
                            <div className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-2.5 pl-8 hover:bg-foreground/[0.03]">
                              <Checkbox
                                checked={diffApplyState}
                                aria-label={`Select all changes for ${diff.entityName}`}
                                onCheckedChange={(checked) => toggleTableSelection(diff.entityRelPath, diff.sourceIndex, checked === true)}
                              />
                              <button
                                type="button"
                                className="flex min-w-0 basis-64 flex-1 items-center gap-2 text-left"
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} changes for ${diff.entityName}`}
                                onClick={() => {
                                  setExpandedTables((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(key)) next.delete(key);
                                    else next.add(key);
                                    return next;
                                  });
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold">{diff.entityName}</span>
                                  {showSourceContextInHeader && sourceContext ? (
                                    <span className="block truncate text-xs font-normal text-muted-foreground" title={diff.sourceLocation}>
                                      {sourceContext}
                                    </span>
                                  ) : null}
                                </span>
                              </button>

                              <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1.5 text-xs">
                                {diff.summary?.newColumns ? <Badge variant="secondary" title="New columns">+{diff.summary.newColumns}</Badge> : null}
                                {diff.summary?.removedColumns ? <Badge variant="secondary" title="Removed columns">-{diff.summary.removedColumns}</Badge> : null}
                                {changedCount ? <Badge variant="secondary" title="Changed columns">~{changedCount}</Badge> : null}
                                {diff.summary?.relationshipChanges ? <Badge variant="secondary">rel {diff.summary.relationshipChanges}</Badge> : null}
                                <Badge variant="outline">{diffSelected}/{diffTotal} selected</Badge>
                              </div>
                            </div>

                            {isExpanded ? (
                              <div className="min-w-0 border-t border-border/60 px-4 py-3 pl-8">
                                {!showSourceContextInHeader && diff.sourceLocation ? (
                                  <div className="mb-3 flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground">
                                    <span className="shrink-0 font-medium">Source</span>
                                    <span className="min-w-0 break-all font-mono">{diff.sourceLocation}</span>
                                  </div>
                                ) : null}
                                <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[56px]">Apply</TableHead>
                            <TableHead className="w-[28%]">Column</TableHead>
                            <TableHead className="w-[24%]">Changes</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columnGroups.map(({ columnName, changes }) => {
                            const colKey = `${key}:${columnName}`;
                            const isColExpanded = expandedColumns.has(colKey);
                            const flags =
                              sel?.changes.filter((c) => c.columnName === columnName).map((c) => c.applyToEntity) || [];
                            const colState = externalSchemaTriState(flags);
                            const selectedByType = new Map<SchemaChangeType, boolean>();
                            sel?.changes
                              .filter((c) => c.columnName === columnName)
                              .forEach((c) => selectedByType.set(c.changeType, c.applyToEntity));

                            return (
                              <React.Fragment key={colKey}>
                                <TableRow>
                                  <TableCell>
                                    <Checkbox
                                      checked={colState}
                                      onCheckedChange={(checked) =>
                                        toggleChangeSelection(diff.entityRelPath, diff.sourceIndex, columnName, checked === true)
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-0 font-medium">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                          setExpandedColumns((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(colKey)) next.delete(colKey);
                                            else next.add(colKey);
                                            return next;
                                          });
                                        }}
                                        aria-label={isColExpanded ? "Hide details" : "Show details"}
                                      >
                                        {isColExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </button>
                                      <span className="truncate">{columnName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {changes.map((c) => (
                                        <span key={c.changeType}>{renderChangeBadge(c.changeType)}</span>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="break-words text-xs text-muted-foreground">
                                    <div className="flex min-w-0 flex-col gap-1">
                                      {changes.slice(0, 2).map((c) => (
                                        <div key={c.changeType}>{renderChangeSummary(c)}</div>
                                      ))}
                                      {changes.length > 2 ? (
                                        <div className="text-muted-foreground">+{changes.length - 2} more...</div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {isColExpanded ? (
                                  <TableRow>
                                    <TableCell colSpan={4} className="bg-card/60">
                                      <div className="grid gap-2">
                                        {changes.map((c) => {
                                          const checked = selectedByType.get(c.changeType) ?? false;
                                          return (
                                            <div key={c.changeType} className="flex items-start gap-2 text-sm">
                                              <Checkbox
                                                checked={checked}
                                                onCheckedChange={(next) =>
                                                  toggleChangeTypeSelection(
                                                    diff.entityRelPath,
                                                    diff.sourceIndex,
                                                    columnName,
                                                    c.changeType,
                                                    next === true,
                                                  )
                                                }
                                              />
                                              <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                  {renderChangeBadge(c.changeType)}
                                                  {!isRelationshipChange(c) && c.entityAttributeName ? (
                                                    <span className="text-xs text-muted-foreground">-&gt; {c.entityAttributeName}</span>
                                                  ) : null}
                                                </div>
                                                <div className="break-words text-xs text-muted-foreground">{renderChangeSummary(c)}</div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                                </Table>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderResultStep = () => (
    <div className="flex flex-col items-center justify-center h-[300px] gap-4">
      <div className="codex-popup-success flex h-16 w-16 items-center justify-center rounded-full">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold">Update Complete</h3>
      <div className="text-center text-muted-foreground max-w-md">
        Updated {applyResult?.updatedEntities?.length || 0} entities.
        {applyResult?.failures?.length ? ` ${applyResult.failures.length} entities failed and can be retried.` : " Mappings have been synchronized with the external source."}
      </div>
    </div>
  );

  if (effectiveScope.kind === "browseSource" || effectiveScope.kind === "browseRelationship") {
    const columns = Array.isArray(browseSelection?.metadata?.columns) ? browseSelection.metadata.columns : [];
    const selectedColumnNames = browseSelection?.selectedColumns || new Set<string>();
    const invalidMappings = browseExistingMappings.filter((mapping) => {
      const mappedName = effectiveScope.kind === "browseRelationship"
        ? `${mapping.target ?? mapping.targetName ?? ""}`
        : `${mapping.sourceName ?? mapping.source ?? ""}`;
      return !!mappedName && !selectedColumnNames.has(mappedName);
    });
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="refresh-schemas-dialog max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {effectiveScope.kind === "browseSource" ? "Select external source" : "Select relationship target"}
            </DialogTitle>
          </DialogHeader>
          {!browseSelection ? (
            <ExternalSourceConfigurator
              dataSource={effectiveScope.dataSourceName}
              dataSourceObject={browseDataSourceObject || configuredDataSources.get(effectiveScope.dataSourceName) || {}}
              solutionPath={solutionPath || ""}
              selectedTable={effectiveScope.sourceLocation}
              mode="wizard-single"
              onCancel={onClose}
              onTableSelected={(table, metadata) => {
                const selectedColumns = new Set<string>(
                  (Array.isArray(metadata?.columns) ? metadata.columns : [])
                    .map((column: any) => `${column?.name || ""}`)
                    .filter(Boolean),
                );
                setBrowseSelection({ table, metadata, selectedColumns });
              }}
            />
          ) : (
            <div className="flex min-h-0 flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div>
                  <div className="text-sm font-semibold">Review schema</div>
                  <div className="text-xs text-muted-foreground">
                    {effectiveScope.dataSourceName} / {browseSelection.table}
                  </div>
                </div>
                <Badge variant="outline">{columns.length} columns</Badge>
              </div>
              <ScrollArea className="max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[52px]">Apply</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Nullable</TableHead>
                      <TableHead>Key</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((column: any) => (
                      <TableRow key={column.name}>
                        <TableCell>
                          <Checkbox
                            checked={browseSelection.selectedColumns.has(column.name)}
                            onCheckedChange={(checked) => setBrowseSelection((previous) => {
                              if (!previous) return previous;
                              const selectedColumns = new Set(previous.selectedColumns);
                              if (checked === true) selectedColumns.add(column.name); else selectedColumns.delete(column.name);
                              return { ...previous, selectedColumns };
                            })}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{column.name}</TableCell>
                        <TableCell className="font-mono text-xs">{formatType(column.dataType)}</TableCell>
                        <TableCell>{column.isNullable ? "Yes" : "No"}</TableCell>
                        <TableCell>{column.isPrimaryKey ? "PK" : ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {invalidMappings.length ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{invalidMappings.length} mapping(s) are not present in the selected schema</AlertTitle>
                  <AlertDescription>
                    <label className="mt-2 flex items-center gap-2">
                      <Checkbox
                        checked={removeInvalidMappings}
                        onCheckedChange={(checked) => setRemoveInvalidMappings(checked === true)}
                      />
                      Remove invalid mappings when applying
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter className="border-t border-border/70 pt-4">
                <Button variant="outline" onClick={() => setBrowseSelection(null)}>Back</Button>
                <Button onClick={() => {
                  const metadata = {
                    ...browseSelection.metadata,
                    columns: columns.filter((column: any) => browseSelection.selectedColumns.has(column.name)),
                    removeInvalidMappings,
                  };
                  onBrowseApply?.(browseSelection.table, metadata);
                  onClose();
                }} disabled={browseSelection.selectedColumns.size === 0}>
                  Apply selection ({browseSelection.selectedColumns.size})
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="refresh-schemas-dialog w-[calc(100vw-2rem)] min-w-0 max-h-[90vh] max-w-5xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {effectiveScope.kind === "all" ? "Refresh schemas" : `Refresh schemas: ${effectiveScope.dataSourceName}`}
          </DialogTitle>
        </DialogHeader>

        {errorMessage && (
          <div className="codex-popup-error mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {errorMessage}
          </div>
        )}

        {step === STEPS.SELECT && renderSelectStep()}
        {step === STEPS.PREVIEW && renderPreviewStep()}
        {step === STEPS.RESULT && renderResultStep()}

        <DialogFooter className="min-w-0 flex-wrap border-t border-border/70 pt-4" data-testid="schema-review-footer">
          {step === STEPS.SELECT && (
            <>
              <Button variant="outline" onClick={() => {
                if (isLoading) abortRef.current?.abort();
                else onClose();
              }}>{isLoading ? "Stop" : "Cancel"}</Button>
              <Button onClick={handleScan} disabled={isLoading || selectedUsages.size === 0}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? `Scanning ${scanProgress.completed}/${scanProgress.total}` : "Scan selected sources"}
              </Button>
            </>
          )}
          {step === STEPS.PREVIEW && (
            <>
              <Button variant="outline" onClick={() => setStep(STEPS.SELECT)}>Back</Button>
              <Button variant="secondary" onClick={() => void handleApply(true)} disabled={isLoading || selectionStats.total === 0}>
                Apply all changes
              </Button>
              <Button onClick={() => void handleApply(false)} disabled={isLoading || selectionStats.selected === 0}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Apply selection ({selectionStats.selected})
              </Button>
            </>
          )}
          {step === STEPS.RESULT && (
            <>
              {applyResult?.failures?.length ? (
                <Button
                  variant="secondary"
                  onClick={() => void handleApply(
                    false,
                    new Set<string>(applyResult.failures.map((failure: { entityRelPath: string }) => failure.entityRelPath)),
                  )}
                  disabled={isLoading}
                >
                  Retry failed
                </Button>
              ) : null}
              <Button onClick={onClose}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


