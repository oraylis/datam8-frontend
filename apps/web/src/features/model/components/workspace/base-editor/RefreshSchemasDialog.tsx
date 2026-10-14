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
  AlertDescription,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@datam8/ui";
import { Loader2, AlertTriangle, FileText, CheckCircle2, ChevronDown, ChevronRight, Database } from "lucide-react";
import { useSolution } from "../../../../solution/SolutionContext";
import { useModelEditor } from "../../../ModelEditorContext";
import { apiBase } from "../../../../../config";
import { readBackendErrorMessage } from "../../../../../shared/api/errorMessage";
import { saveModelEntityByRelPath } from "../../../../../shared/api/v2Client";
import { modelLocatorFromRelPath } from "../../../locator-utils";
import { ensureLoaded as ensureConnectorCatalogLoaded, useConnectorCatalog } from "../../../../../shared/connectors/connectorCatalog";
import { ExternalModelSource } from "../../../generated-schema-types";
import { ExternalSourceConfigurator } from "../../wizard/SourceRow";
import {
  formatDeepDiffValue,
  groupAttributeChanges,
  groupExternalSourceChanges,
  presentDeepDiff,
  affectedChanges,
  type DeepDiffEntry,
} from "./deepDiffPresenter";
import {
  externalSchemaTriState,
  groupExternalSchemaUsages,
  isUsageInitiallySelected,
  isUsageInExternalSchemaScope,
  type ExternalSchemaScope,
} from "./externalSchemaScope";

import {
  ChangeSummary,
  ObjectChanges,
  ColumnsSection,
  SourcesSection,
  RefreshReviewExpansion,
  reviewNodeKeys,
} from "./RefreshChangeReview";

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

type ExternalSourceSchemaDiff = {
  entityRelPath: string;
  entityName: string;
  sourceIndex: number;
  dataSource: string;
  sourceAlias?: string;
  sourceLocation: string;
  refreshedSources?: ExternalModelSource[];
  refreshedEntity?: any;
  changes: DeepDiffEntry[];
};

type ScanFailure = {
  message: string;
};

const diffKey = (entityRelPath: string, sourceIndex: number) => `${entityRelPath}:${sourceIndex}`;

type TriState = boolean | "indeterminate";
type HttpError = Error & { status?: number };
type RefreshMode = "complete" | "sources-only";
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
  const [refreshMode, setRefreshMode] = useState<RefreshMode>("complete");
  const [isLoading, setIsLoading] = useState(false);
  const [usages, setUsages] = useState<ExternalSourceUsage[]>([]);
  const [selectedUsages, setSelectedUsages] = useState<Set<string>>(new Set()); // `${entityRelPath}:${sourceIndex}`
  const [diffs, setDiffs] = useState<ExternalSourceSchemaDiff[]>([]);
  const [selectedDiffKeys, setSelectedDiffKeys] = useState<Set<string>>(new Set());
  const [applyResult, setApplyResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyWarning, setDirtyWarning] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState("");
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  const [expandedReviewNodes, setExpandedReviewNodes] = useState<Set<string>>(new Set());
  const [authErrorHint, setAuthErrorHint] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState({ completed: 0, total: 0 });
  const [scanErrors, setScanErrors] = useState<Record<string, ScanFailure>>({});
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
      setRefreshMode("complete");
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
          const matchesScope = sources.some((source: any, sourceIndex: number) =>
            isUsageInExternalSchemaScope(effectiveScope, {
              dataSource: `${source?.dataSource || ""}`.trim(),
              entityRelPath: entity.relPath,
              sourceIndex,
            }));
          if (!matchesScope) return;
          sources.forEach((source: any, sourceIndex: number) => {
            const ds = `${source?.dataSource || ""}`.trim();
            if (!ds) return;
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
        const initiallySelectedEntities = new Set(nextUsages
          .filter((usage) => usage.connectorId && isUsageInitiallySelected(effectiveScope, usage))
          .map((usage) => usage.entityRelPath));
        setSelectedUsages(new Set(
          nextUsages
            .filter((usage) => initiallySelectedEntities.has(usage.entityRelPath))
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
    const usage = usages.find((item) => `${item.entityRelPath}:${item.sourceIndex}` === key);
    const related = usages.filter((item) => item.entityRelPath === usage?.entityRelPath);
    const checked = !next.has(key);
    related.forEach((item) => {
      const itemKey = `${item.entityRelPath}:${item.sourceIndex}`;
      if (checked) next.add(itemKey); else next.delete(itemKey);
    });
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
      const entitiesToScan = Array.from(new Map(
        usagesToScan.map((usage) => [usage.entityRelPath, usage]),
      ).values());
      setScanProgress({ completed: 0, total: entitiesToScan.length });
      setScanErrors({});
      const fetchedDiffs: ExternalSourceSchemaDiff[] = [];
      const failures: Record<string, ScanFailure> = {};
      await Promise.all(entitiesToScan.map(async (usage) => {
        try {
          const locator = modelLocatorFromRelPath(usage.entityRelPath).replace(/^\/+/, "");
          const response = await fetch(
            `${apiBase}/sources/compare?locator=${encodeURIComponent(locator)}&mode=${refreshMode}`,
            { signal: controller.signal },
          );
          const payload = await response.json();
          if (!response.ok) {
            throw toHttpError(
              readBackendErrorMessage(payload, `Failed to refresh sources (${response.status})`),
              response.status,
            );
          }
          const refreshedEntity = payload?.wrapper?.entity;
          const refreshedSources = refreshedEntity?.sources;
          if (!Array.isArray(refreshedSources)
            || (refreshMode === "complete" && !Array.isArray(refreshedEntity?.attributes))) {
            throw new Error("Refresh response did not contain a valid entity");
          }
          const entity = modelEntities.find((item) => item.relPath === usage.entityRelPath);
          if (!entity) throw new Error(`Entity not found: ${usage.entityRelPath}`);
          if (typeof payload.has_changes !== "boolean") {
            throw new Error("Refresh response did not contain change status");
          }
          if (payload.has_changes) {
            const changes = presentDeepDiff(payload.diff, entity.content, refreshedEntity);
            fetchedDiffs.push({
              entityRelPath: usage.entityRelPath,
              entityName: usage.entityName,
              sourceIndex: usage.sourceIndex,
              dataSource: usage.dataSource,
              sourceAlias: usage.sourceAlias,
              sourceLocation: usage.sourceLocation,
              refreshedSources,
              refreshedEntity: refreshMode === "complete" ? refreshedEntity : undefined,
              changes,
            });
          }
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            failures[`${usage.entityRelPath}:${usage.sourceIndex}`] = {
              message: err?.message || "Failed to refresh sources",
            };
          }
        } finally {
          setScanProgress((previous) => ({ ...previous, completed: previous.completed + 1 }));
        }
      }));
      setScanErrors(failures);
      setDiffs(fetchedDiffs);

      setSelectedDiffKeys(new Set(
        fetchedDiffs.map((diff) => diffKey(diff.entityRelPath, diff.sourceIndex)),
      ));
      setExpandedEntities(new Set());
      setExpandedReviewNodes(new Set());
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

  const toggleTableSelection = (entityRelPath: string, sourceIndex: number, checked: boolean) => {
    const key = diffKey(entityRelPath, sourceIndex);
    setSelectedDiffKeys((previous) => {
      const next = new Set(previous);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const toggleDataSourceSelection = (sourceDiffs: ExternalSourceSchemaDiff[], checked: boolean) => {
    const keys = new Set(sourceDiffs.map((diff) => diffKey(diff.entityRelPath, diff.sourceIndex)));
    setSelectedDiffKeys((previous) => {
      const next = new Set(previous);
      keys.forEach((key) => {
        if (checked) next.add(key); else next.delete(key);
      });
      return next;
    });
  };

  const setAllSelected = (checked: boolean) => {
    setSelectedDiffKeys(checked
      ? new Set(diffs.map((diff) => diffKey(diff.entityRelPath, diff.sourceIndex)))
      : new Set());
  };

  const selectionStats = { total: diffs.length, selected: selectedDiffKeys.size };

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

  const handleApply = async (applyAll = false, onlyRelPaths?: Set<string>) => {
    const hasDestructiveChanges = diffs.some((diff) =>
      diff.changes.some((change) => change.operation === "removed"),
    );
    if (applyAll && hasDestructiveChanges && !window.confirm("Apply all changes, including removals?")) return;

    setIsLoading(true);
    setError(null);
    setAuthErrorHint(null);
    try {
      const nextByEntity = new Map<string, any>();

      for (const diff of diffs) {
        if (onlyRelPaths && !onlyRelPaths.has(diff.entityRelPath)) continue;
        const key = diffKey(diff.entityRelPath, diff.sourceIndex);
        if (!applyAll && !selectedDiffKeys.has(key)) continue;

        const current = modelEntities.find((entity) => entity.relPath === diff.entityRelPath);
        if (!current) continue;
        const nextContent = nextByEntity.get(diff.entityRelPath) || structuredClone(current.content || {});
        if (refreshMode === "sources-only" && diff.refreshedSources) {
          nextContent.sources = structuredClone(diff.refreshedSources);
          nextByEntity.set(diff.entityRelPath, nextContent);
          continue;
        }
        if (refreshMode === "complete" && diff.refreshedEntity) {
          nextContent.attributes = structuredClone(diff.refreshedEntity.attributes);
          nextContent.properties = structuredClone(diff.refreshedEntity.properties);
          nextContent.sources = structuredClone(diff.refreshedEntity.sources);
          nextByEntity.set(diff.entityRelPath, nextContent);
          continue;
        }
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 text-sm text-muted-foreground">
          {refreshMode === "sources-only"
            ? "Refresh only source mappings and source metadata; entity attributes remain unchanged."
            : "Select the external sources to scan. Sources are grouped by Data Source; exclusions apply only to this run."}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 text-xs text-muted-foreground">
          <label htmlFor="refresh-mode" className="whitespace-nowrap">
            Refresh mode
          </label>
          <Select
            value={refreshMode}
            onValueChange={(value) => setRefreshMode(value as RefreshMode)}
          >
            <SelectTrigger id="refresh-mode" aria-label="Refresh mode" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="complete">Complete refresh</SelectItem>
              <SelectItem value="sources-only">Source-only refresh</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
                    checked={usages.some((usage) => usage.connectorId)
                      && usages.every((usage) => !usage.connectorId || selectedUsages.has(`${usage.entityRelPath}:${usage.sourceIndex}`))}
                    onCheckedChange={(checked) => {
                    if (checked) {
                      const eligibleEntities = new Set(usages.filter((usage) => usage.connectorId).map((usage) => usage.entityRelPath));
                      setSelectedUsages(new Set(usages.filter((usage) => eligibleEntities.has(usage.entityRelPath)).map((usage) => `${usage.entityRelPath}:${usage.sourceIndex}`)));
                    }
                    else setSelectedUsages(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Refresh scope</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageGroups.map(([sourceName, sourceUsages]) => {
              const eligible = sourceUsages.filter((usage) => usage.connectorId);
              const visibleUsages = sourceUsages.filter((usage, index) => {
                return sourceUsages.findIndex((item) => item.entityRelPath === usage.entityRelPath) === index;
              });
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
                            const related = usages.filter((item) => item.entityRelPath === usage.entityRelPath);
                            related.forEach((item) => {
                              const key = `${item.entityRelPath}:${item.sourceIndex}`;
                              if (checked === true) next.add(key); else next.delete(key);
                            });
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
                  {isExpanded && visibleUsages.map((usage) => {
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
                        <TableCell className="text-sm font-mono">
                          All external sources
                        </TableCell>
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
      return diff.changes.some((change) => [
        change.displayPath,
        change.path,
        formatDeepDiffValue(change.before),
        formatDeepDiffValue(change.after),
      ].some((value) => value.toLowerCase().includes(needle)));
    }) : diffs;
    return [...filtered].sort((left, right) =>
      left.dataSource.localeCompare(right.dataSource) || left.entityName.localeCompare(right.entityName),
    );
  }, [diffs, previewFilter]);

  const filteredDiffGroups = useMemo(() => groupExternalSchemaUsages(filteredDiffs), [filteredDiffs]);

  const affectedChangesByEntity = useMemo(() => new Map(diffs.map((diff) => [
    diffKey(diff.entityRelPath, diff.sourceIndex), affectedChanges(diff.changes),
  ])), [diffs]);
  const allAffectedChanges = [...affectedChangesByEntity.values()].flat();

  const setVisibleReviewExpanded = (expanded: boolean) => {
    const entityKeys = filteredDiffs.map((diff) => diffKey(diff.entityRelPath, diff.sourceIndex));
    const nodeKeys = filteredDiffs.flatMap((diff) => reviewNodeKeys(
      diffKey(diff.entityRelPath, diff.sourceIndex),
      groupAttributeChanges(diff.changes.filter((change) => change.group === "attributes")),
      groupExternalSourceChanges(diff.changes.filter((change) => change.group === "sources" || change.group === "mappings")),
    ));
    const update = (previous: Set<string>, keys: string[], add: boolean) => {
      const next = new Set(previous);
      keys.forEach((key) => {
        if (add) next.add(key); else next.delete(key);
      });
      return next;
    };
    setCollapsedPreviewDataSources((previous) => update(previous, filteredDiffGroups.map(([sourceName]) => sourceName), !expanded));
    setExpandedEntities((previous) => update(previous, entityKeys, expanded));
    setExpandedReviewNodes((previous) => update(previous, nodeKeys, expanded));
  };

  const allDiffsByDataSource = useMemo(() => {
    return new Map(groupExternalSchemaUsages(diffs));
  }, [diffs]);

  const renderPreviewStep = () => (
    <div className="schema-review flex min-w-0 flex-col gap-3 h-[520px] max-h-[calc(90vh-10rem)] overflow-hidden">
      <div className="flex min-w-0 flex-col gap-2">
        {Object.keys(scanErrors).length ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {Object.keys(scanErrors).length === 1
                ? "1 entity refresh request failed"
                : `${Object.keys(scanErrors).length} entity refresh requests failed`}
            </AlertTitle>
            <AlertDescription>
              <p>Successful results remain available. Go back and scan again to retry failed requests.</p>
              <ul className="mt-2 max-h-28 space-y-2 overflow-y-auto">
                {Object.entries(scanErrors).map(([key, failure]) => (
                  <li key={key} className="min-w-0">
                    <div className="whitespace-pre-wrap break-words">{failure.message}</div>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="schema-review__toolbar flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Badge variant="outline" data-testid="global-change-count">{allAffectedChanges.length} changes</Badge>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="global-operation-summary">
              <ChangeSummary changes={allAffectedChanges} />
            </div>
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
            onClick={() => setVisibleReviewExpanded(true)}
            disabled={!filteredDiffs.length}
          >
            Expand all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setVisibleReviewExpanded(false)}
            disabled={!filteredDiffs.length}
          >
            Collapse all
          </Button>
        </div>
      </div>

      <RefreshReviewExpansion.Provider value={{ expanded: expandedReviewNodes, toggle: (nodeKey) => setExpandedReviewNodes((previous) => {
        const next = new Set(previous);
        if (next.has(nodeKey)) next.delete(nodeKey); else next.add(nodeKey);
        return next;
      }) }}>
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
              const groupFlags = sourceDiffs.map((diff) =>
                selectedDiffKeys.has(diffKey(diff.entityRelPath, diff.sourceIndex)),
              );
              const groupSelected = groupFlags.filter(Boolean).length;
              const groupState = externalSchemaTriState(groupFlags);
              const isGroupExpanded = !collapsedPreviewDataSources.has(sourceName);
              const groupLabel = `${sourceName}, ${sourceDiffs.length} ${sourceDiffs.length === 1 ? "entity" : "entities"}`;

              return (
                <section
                  key={sourceName}
                  className="schema-review__group min-w-0 overflow-hidden"
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
                        {sourceDiffs.length} {sourceDiffs.length === 1 ? "entity" : "entities"}
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
                        const diffSelected = selectedDiffKeys.has(key);
                        const modelObjectChanges = diff.changes.filter((change) =>
                          change.group === "entity" || change.group === "entityProperties",
                        );
                        const modelColumnGroups = groupAttributeChanges(
                          diff.changes.filter((change) => change.group === "attributes"),
                        );
                        const sourceGroups = groupExternalSourceChanges(
                          diff.changes.filter((change) => change.group === "sources" || change.group === "mappings"),
                        );
                        const isEntityExpanded = expandedEntities.has(key);
                        const entityAffectedChanges = affectedChangesByEntity.get(key) || [];
                        const totalChangeCount = entityAffectedChanges.length;
                        const toggleEntity = () => setExpandedEntities((previous) => {
                          const next = new Set(previous);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        });
                        return (
                          <div key={key} className="schema-review__entity min-w-0 overflow-hidden" data-testid="schema-review-entity">
                            <div className="flex min-w-0 items-center gap-2 px-4 py-2 pl-8">
                              <Checkbox
                                checked={diffSelected}
                                aria-label={`Select ${diff.entityName} for refresh`}
                                onCheckedChange={(checked) => toggleTableSelection(diff.entityRelPath, diff.sourceIndex, checked === true)}
                              />
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-expanded={isEntityExpanded}
                                aria-label={`${isEntityExpanded ? "Collapse" : "Expand"} changes for ${diff.entityName}`}
                                onClick={toggleEntity}
                              >
                                {isEntityExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                )}
                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate font-semibold">{diff.entityName}</span>
                                <span className="flex shrink-0 flex-wrap justify-end gap-2"><ChangeSummary changes={entityAffectedChanges} /></span>
                                <span className="shrink-0 text-xs text-muted-foreground" data-testid="entity-change-count">{totalChangeCount} {totalChangeCount === 1 ? "change" : "changes"}</span>
                              </button>
                            </div>

                            {isEntityExpanded ? (
                              <div className="px-4 pb-3 pl-[6.5rem]">
                                <section data-testid={modelObjectChanges.length || modelColumnGroups.length ? "model-entity-change-section" : undefined} className="min-w-0">
                                  <ObjectChanges changes={modelObjectChanges} />
                                  <ColumnsSection groups={modelColumnGroups} entityKey={key} />
                                  <SourcesSection sources={sourceGroups} entityKey={key} />
                                </section>
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
      </RefreshReviewExpansion.Provider>
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
            {effectiveScope.kind === "all" ? "Refresh data sources" : `Refresh data source: ${effectiveScope.dataSourceName}`}
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


