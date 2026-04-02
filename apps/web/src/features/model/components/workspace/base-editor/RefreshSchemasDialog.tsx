import React, { useEffect, useMemo, useState } from "react";
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
import { Loader2, AlertTriangle, ArrowRight, FileText, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useSolution } from "../../../../solution/SolutionContext";
import { apiBase } from "../../../../../config";
import { useModelEditor } from "../../../ModelEditorContext";
import { readBackendErrorMessage } from "../../../../../shared/api/errorMessage";
import { saveModelEntityByRelPath } from "../../../../../shared/api/v2Client";
import { normalizeDataTypeForSave } from "../utils/sourceNormalization";

const AUTH_FAILURE_MESSAGE =
  "Authentication failed. Update the Data Source configuration (including secrets) and try again.";

type RefreshSchemasDialogProps = {
  dataSourceName: string;
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
};

type ExternalSourceUsage = {
  entityRelPath: string;
  entityName: string;
  layer?: string;
  sourceIndex: number;
  dataSource: string;
  sourceAlias?: string;
  sourceLocation: string;
};

type SchemaChangeType =
  | "NEW_COLUMN"
  | "REMOVED_COLUMN"
  | "TYPE_CHANGED"
  | "NULLABILITY_CHANGED"
  | "PK_CHANGED";

type ColumnChange = {
  changeType: SchemaChangeType;
  columnName: string;
  sourceBefore?: any;
  sourceAfter?: any;
  entityAttributeName?: string;
  applyToEntitySuggested: boolean;
};

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

export const RefreshSchemasDialog = ({
  dataSourceName,
  dataSource,
  dataSourceType,
  isOpen,
  onClose,
}: RefreshSchemasDialogProps) => {
  const { solutionPath } = useSolution();
  const { setModelEntities, modelTabs, modelEntities } = useModelEditor();
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
  const [knownSchemas, setKnownSchemas] = useState<string[]>([]);

  const dataSourceTypeName = useMemo(
    () => dataSource?.type || dataSource?.dataSourceType || dataSourceType?.name || "",
    [dataSource?.dataSourceType, dataSource?.type, dataSourceType?.name],
  );

  const boundConnectorId = `${dataSourceType?.pluginId || ""}`.trim();

  const isAuthFailure = (status?: number, message?: string) => {
    if (status === 401 || status === 403) return true;
    const m = (message || "").toLowerCase();
    return m.includes("auth_failed") || m.includes("authentication") || m.includes("unauthorized") || m.includes("forbidden");
  };

  const parseSourceLocation = (raw: string): { schema?: string; table: string } => {
    const value = `${raw || ""}`.trim();
    const bracket = value.match(/^\[(.*?)\]\.\[(.*?)\]$/);
    if (bracket) return { schema: bracket[1], table: bracket[2] };
    const dotParts = value.split(".");
    if (dotParts.length === 2) return { schema: dotParts[0].replace(/^\[|\]$/g, ""), table: dotParts[1].replace(/^\[|\]$/g, "") };
    return { table: value };
  };

  const loadSchemas = async () => {
    const endpoint = `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/schemas`;
    const response = await fetch(endpoint);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray((payload as any)?.items) ? (payload as any).items : [];
    return items.map((item: unknown) => `${item || ""}`.trim()).filter(Boolean);
  };

  const listTablesForSchema = async (schemaName: string) => {
    const endpoint = `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/schemas/${encodeURIComponent(schemaName)}/tables`;
    const response = await fetch(endpoint);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    const items = Array.isArray((payload as any)?.items) ? (payload as any).items : [];
    return items
      .map((item: any) => `${item?.name || ""}`.trim())
      .filter(Boolean);
  };

  const loadSourceFields = async (sourceLocation: string) => {
    const parsed = parseSourceLocation(sourceLocation);
    const loadViaSchema = async (schemaName: string) => {
      const endpoint = `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(parsed.table)}`;
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw toHttpError(
          readBackendErrorMessage(payload, `Failed to load source metadata (${response.status})`),
          response.status,
        );
      }
      return Array.isArray((payload as any)?.items) ? (payload as any).items : [];
    };

    const loadWithoutSchema = async () => {
      const endpoint = `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/tables/${encodeURIComponent(parsed.table)}`;
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw toHttpError(
          readBackendErrorMessage(payload, `Failed to load source metadata (${response.status})`),
          response.status,
        );
      }
      return Array.isArray((payload as any)?.items) ? (payload as any).items : [];
    };

    if (parsed.schema) {
      return await loadViaSchema(parsed.schema);
    }

    const schemas = await loadSchemas();
    if (schemas.length > 0) {
      setKnownSchemas(schemas);
      for (const schemaName of schemas) {
        const schemaTables = await listTablesForSchema(schemaName);
        if (!schemaTables.some((name: string) => name.toLowerCase() === parsed.table.toLowerCase())) continue;
        return await loadViaSchema(schemaName);
      }
    } else {
      setKnownSchemas([]);
    }

    return await loadWithoutSchema();
  };

  const computeUsageDiff = (usage: ExternalSourceUsage, fields: any[]) => {
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
    const sourceByName = new Map<string, any>();
    for (const field of fields) {
      const name = `${field?.name || ""}`.trim();
      if (name) sourceByName.set(name, field);
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
      },
    } as ExternalSourceSchemaDiff;
  };

  // Load Usages on Open
  useEffect(() => {
    if (isOpen && dataSourceName) {
      setStep(STEPS.SELECT);
      setIsLoading(true);
      setError(null);
      setAuthErrorHint(null);
      setDirtyWarning(null);
      setKnownSchemas([]);
      try {
        const nextUsages: ExternalSourceUsage[] = [];
        modelEntities.forEach((entity) => {
          const sources = Array.isArray(entity.content?.sources) ? entity.content.sources : [];
          sources.forEach((source: any, sourceIndex: number) => {
            const ds = `${source?.dataSource || ""}`.trim();
            if (!ds || ds !== dataSourceName) return;
            nextUsages.push({
              entityRelPath: entity.relPath,
              entityName: entity.name,
              sourceIndex,
              dataSource: ds,
              sourceAlias: typeof source?.sourceAlias === "string" ? source.sourceAlias : undefined,
              sourceLocation: `${source?.sourceLocation || ""}`,
            });
          });
        });
        setUsages(nextUsages);
        setSelectedUsages(new Set(nextUsages.map((u) => `${u.entityRelPath}:${u.sourceIndex}`)));
      } catch (err: any) {
        setError(err?.message || "Failed to inspect source usages");
      } finally {
        setIsLoading(false);
      }
    }
  }, [isOpen, dataSourceName, modelEntities, solutionPath]);

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
    const usagesToScan = usages
      .filter((u) => selectedUsages.has(`${u.entityRelPath}:${u.sourceIndex}`))
      .map((u) => ({ entityRelPath: u.entityRelPath, sourceIndex: u.sourceIndex }));

    const dirtyEntities = usagesToScan.filter(u => 
        modelTabs.some(t => t.relPath === u.entityRelPath && t.dirty)
    );

    if (dirtyEntities.length > 0) {
        setDirtyWarning(`Warning: ${dirtyEntities.length} selected entity(s) have unsaved changes. Proceeding will overwrite them. Save them first or proceed with caution.`);
    }

    try {
      const usageMap = new Map(usages.map((u) => [`${u.entityRelPath}:${u.sourceIndex}`, u] as const));
      const fetchedDiffs: ExternalSourceSchemaDiff[] = [];
      for (const usageRef of usagesToScan) {
        const usage = usageMap.get(`${usageRef.entityRelPath}:${usageRef.sourceIndex}`);
        if (!usage) continue;
        const fields = await loadSourceFields(usage.sourceLocation);
        const diff = computeUsageDiff(usage, fields);
        if (diff) fetchedDiffs.push(diff);
      }
      setDiffs(fetchedDiffs);

      const initialSelections: DiffSelection[] = fetchedDiffs.map((diff) => ({
        entityRelPath: diff.entityRelPath,
        sourceIndex: diff.sourceIndex,
        changes: diff.changes.map((c) => ({
          columnName: c.columnName,
          changeType: c.changeType,
          applyToEntity: false,
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

      setStep(STEPS.PREVIEW);
    } catch (err: any) {
      const status = err?.status;
      const message = err?.message || "Failed to scan schemas";
      if (!handleAuthFailure(status, message)) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const diffKey = (entityRelPath: string, sourceIndex: number) => `${entityRelPath}:${sourceIndex}`;

  const selectionByKey = useMemo(() => {
    const map = new Map<string, DiffSelection>();
    selections.forEach((s) => map.set(diffKey(s.entityRelPath, s.sourceIndex), s));
    return map;
  }, [selections]);

  const triStateFrom = (values: boolean[]): TriState => {
    if (!values.length) return false;
    const anyTrue = values.some(Boolean);
    const anyFalse = values.some((v) => !v);
    if (anyTrue && anyFalse) return "indeterminate";
    return anyTrue ? true : false;
  };

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

  const handleApply = async () => {
    setIsLoading(true);
    setError(null);
    setAuthErrorHint(null);
    try {
        const selectionMap = new Map<string, DiffSelection>(
          selections.map((sel) => [`${sel.entityRelPath}:${sel.sourceIndex}`, sel] as const),
        );
        const updatedEntities: Array<{ entityRelPath: string; content: any }> = [];

        for (const diff of diffs) {
          const key = `${diff.entityRelPath}:${diff.sourceIndex}`;
          const selection = selectionMap.get(key);
          if (!selection) continue;
          const selectedKeys = new Set(
            selection.changes
              .filter((entry) => entry.applyToEntity)
              .map((entry) => `${entry.columnName}::${entry.changeType}`),
          );
          if (!selectedKeys.size) continue;

          const current = modelEntities.find((entity) => entity.relPath === diff.entityRelPath);
          if (!current) continue;
          const nextContent = structuredClone(current.content || {});
          const attrs = Array.isArray(nextContent.attributes) ? nextContent.attributes : [];
          const sources = Array.isArray(nextContent.sources) ? nextContent.sources : [];
          const sourceEntry = sources[diff.sourceIndex];
          const sourceMappings = Array.isArray(sourceEntry?.mapping) ? sourceEntry.mapping : [];
          const byName = new Map<string, any>();
          attrs.forEach((attr: any, index: number) => byName.set(`${attr?.name || ""}`, { attr, index }));

          const findSourceMappingIndex = (columnName: string) =>
            sourceMappings.findIndex((m: any) => {
              const sourceName = `${m?.sourceName || ""}`.trim();
              return sourceName === columnName;
            });

          for (const change of diff.changes) {
            const marker = `${change.columnName}::${change.changeType}`;
            if (!selectedKeys.has(marker)) continue;
            if (change.changeType === "TYPE_CHANGED" || change.changeType === "NULLABILITY_CHANGED") {
              const mappingIndex = findSourceMappingIndex(change.columnName);
              if (mappingIndex >= 0) {
                const mappingItem = sourceMappings[mappingIndex] || {};
                const currentSourceDataType = normalizeDataTypeForSave(mappingItem?.sourceDataType) || {};
                const nextSourceDataType = normalizeDataTypeForSave(
                  change.sourceAfter?.sourceDataType || {
                    type: change.sourceAfter?.dataType,
                    nullable: change.sourceAfter?.isNullable,
                    charLen: change.sourceAfter?.maxLength,
                    precision: change.sourceAfter?.numericPrecision,
                    scale: change.sourceAfter?.numericScale,
                  },
                );
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
            const existing = attrKey ? byName.get(attrKey) : undefined;
            if (change.changeType === "NEW_COLUMN" && !existing) {
              attrs.push({
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
              continue;
            }
            if (change.changeType === "REMOVED_COLUMN" && existing) {
              attrs.splice(existing.index, 1);
              continue;
            }
            if (!existing) continue;
            const targetAttr = existing.attr;
            if (!targetAttr.dataType || typeof targetAttr.dataType !== "object") {
              targetAttr.dataType = {};
            }
            if (change.changeType === "PK_CHANGED") {
              targetAttr.isBusinessKey = Boolean(change.sourceAfter?.isPrimaryKey);
            }
          }

          if (sourceEntry) {
            sourceEntry.mapping = sourceMappings;
            sources[diff.sourceIndex] = sourceEntry;
            nextContent.sources = sources;
          }

          nextContent.attributes = attrs.map((attr: any, index: number) => ({
            ...attr,
            ordinalNumber: index + 1,
          }));
          await saveModelEntityByRelPath(diff.entityRelPath, nextContent);
          updatedEntities.push({ entityRelPath: diff.entityRelPath, content: nextContent });
        }

        if (updatedEntities.length) {
          setModelEntities((prev) =>
            prev.map((entity) => {
              const updated = updatedEntities.find((entry) => entry.entityRelPath === entity.relPath);
              return updated ? { ...entity, content: updated.content } : entity;
            }),
          );
        }

        setApplyResult(updatedEntities);
        onClose();
    } catch (err: any) {
        const status = err?.status;
        const message = err?.message || "Failed to apply changes";
        if (!handleAuthFailure(status, message)) {
          setError(message);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const renderSelectStep = () => (
    <div className="flex flex-col gap-4 h-[400px]">
      <div className="text-sm text-muted-foreground">
        Select which external sources referencing this Data Source should be scanned for schema changes.
      </div>
      
      {!boundConnectorId ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No connector linked</AlertTitle>
          <AlertDescription>
            Link a connector on <b>{dataSourceTypeName || "this Data Source Type"}</b> before refreshing schemas.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="text-sm text-muted-foreground">
          Connector: <b>{boundConnectorId}</b>. Uses the saved Data Source configuration and secret references.
          {knownSchemas.length > 0 ? <> Detected schemas: <b>{knownSchemas.length}</b>.</> : null}
        </div>
      )}

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
                    checked={selectedUsages.size === usages.length && usages.length > 0} 
                    onCheckedChange={(checked) => {
                        if (checked) setSelectedUsages(new Set(usages.map(u => `${u.entityRelPath}:${u.sourceIndex}`)));
                        else setSelectedUsages(new Set());
                    }}
                />
              </TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Source Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usages.map((u) => {
              const key = `${u.entityRelPath}:${u.sourceIndex}`;
              const isDirty = modelTabs.some(t => t.relPath === u.entityRelPath && t.dirty);
              return (
                <TableRow key={key}>
                  <TableCell>
                    <Checkbox checked={selectedUsages.has(key)} onCheckedChange={() => toggleUsage(key)} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                        {u.entityName}
                        {isDirty && <Badge variant="secondary" className="text-[10px] h-4">Dirty</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.layer || u.entityRelPath}</div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{u.sourceLocation}</TableCell>
                </TableRow>
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
    if (!needle) return diffs;
    return diffs.filter((diff) => {
      const header = `${diff.entityName} ${diff.sourceAlias || ""} ${diff.sourceLocation}`.toLowerCase();
      if (header.includes(needle)) return true;
      return diff.changes.some((c) => (c.columnName || "").toLowerCase().includes(needle));
    });
  }, [diffs, previewFilter]);

  const renderPreviewStep = () => (
    <div className="flex flex-col gap-4 h-[520px]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium">
            Changes detected: {diffs.reduce((acc, d) => acc + d.changes.length, 0)} | Selected: {selectionStats.selected}/{selectionStats.total}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={previewFilter}
              onChange={(e) => setPreviewFilter(e.target.value)}
              placeholder="Filter tables / columns..."
              className="h-8 w-64"
            />
            <Button size="sm" variant="ghost" onClick={() => setAllSelected(true)} disabled={!selectionStats.total}>
              Select all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAllSelected(false)} disabled={!selectionStats.total}>
              Deselect all
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setExpandedTables(new Set(filteredDiffs.map((d) => diffKey(d.entityRelPath, d.sourceIndex))))}
            disabled={!filteredDiffs.length}
          >
            Expand all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setExpandedTables(new Set())}
            disabled={!filteredDiffs.length}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
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
          <div className="flex flex-col gap-3">
            {filteredDiffs.map((diff) => {
              const key = diffKey(diff.entityRelPath, diff.sourceIndex);
              const isExpanded = expandedTables.has(key);
              const sel = selectionByKey.get(key);
              const diffApplyState = triStateFrom(sel?.changes.map((c) => c.applyToEntity) || []);
              const diffSelected = sel?.changes.filter((c) => c.applyToEntity).length || 0;
              const diffTotal = sel?.changes.length || 0;
              const changedCount =
                (diff.summary?.typeChanges || 0) +
                (diff.summary?.nullableChanges || 0) +
                (diff.summary?.pkChanges || 0);
              const columnGroups = getColumnGroups(diff);

              return (
                <div key={key} className="codex-popup-section">
                  <div className="flex items-center gap-3 border-b border-border/65 px-3 py-2">
                    <Checkbox
                      checked={diffApplyState}
                      onCheckedChange={(checked) => toggleTableSelection(diff.entityRelPath, diff.sourceIndex, checked === true)}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
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
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-semibold truncate">
                            {diff.sourceAlias || diff.sourceLocation || diff.entityName}
                          </span>
                          <span className="text-xs text-muted-foreground mono truncate">{diff.sourceLocation}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{diff.entityName}</div>
                      </div>
                    </button>

                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      {diff.summary?.newColumns ? <Badge variant="secondary">+{diff.summary.newColumns}</Badge> : null}
                      {diff.summary?.removedColumns ? <Badge variant="secondary">-{diff.summary.removedColumns}</Badge> : null}
                      {changedCount ? <Badge variant="secondary">~{changedCount}</Badge> : null}
                      <Badge variant="outline">
                        {diffSelected}/{diffTotal} selected
                      </Badge>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="p-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]">Apply</TableHead>
                            <TableHead className="w-[220px]">Column</TableHead>
                            <TableHead className="w-[190px]">Changes</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columnGroups.map(({ columnName, changes }) => {
                            const colKey = `${key}:${columnName}`;
                            const isColExpanded = expandedColumns.has(colKey);
                            const flags =
                              sel?.changes.filter((c) => c.columnName === columnName).map((c) => c.applyToEntity) || [];
                            const colState = triStateFrom(flags);
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
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
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
                                  <TableCell className="text-xs text-muted-foreground">
                                    <div className="flex flex-col gap-1">
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
                                                  {c.entityAttributeName ? (
                                                    <span className="text-xs text-muted-foreground">-&gt; {c.entityAttributeName}</span>
                                                  ) : null}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{renderChangeSummary(c)}</div>
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
              Updated {applyResult?.length || 0} entities.
              Mappings have been synchronized with the external source.
          </div>
      </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="refresh-schemas-dialog max-h-[90vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Refresh Schemas: {dataSourceName}</DialogTitle>
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

        <DialogFooter className="border-t border-border/70 pt-4">
          {step === STEPS.SELECT && (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleScan} disabled={isLoading || selectedUsages.size === 0 || !boundConnectorId}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Scan selected sources
              </Button>
            </>
          )}
          {step === STEPS.PREVIEW && (
            <>
              <Button variant="outline" onClick={() => setStep(STEPS.SELECT)}>Back</Button>
              <Button onClick={handleApply} disabled={isLoading || selectionStats.selected === 0}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Apply Changes
              </Button>
            </>
          )}
          {step === STEPS.RESULT && (
              <Button onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


