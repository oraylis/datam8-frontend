import { useCallback, useEffect, useMemo, useRef, useState, CSSProperties, type ChangeEvent } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  WorkTabs,
} from "@datam8/ui";
import { useTheme } from "@datam8/ui/theme";
import { Bot, RefreshCw } from "lucide-react";
import type { PropertyRefactorPayload } from "@datam8/types";
import { Sidebar } from "../features/model/components/Sidebar";
import { Workspace } from "../features/model/components/Workspace";
import { FolderEditor } from "../features/model/components/workspace/folder-editor/FolderEditor";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { RefreshSchemasDialog } from "../features/model/components/workspace/base-editor/RefreshSchemasDialog";
import { SolutionDialog } from "./SolutionDialog";
import { CreateModelEntityWizard } from "../features/model/components/CreateModelEntityWizard";
import { MoveEntitiesDialog } from "../features/model/components/MoveEntitiesDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { WindowsTitleBar } from "./WindowsTitleBar";
import { useSolution } from "../features/solution/SolutionContext";
import { MigrateSolutionV1Wizard } from "../features/migration/components/MigrateSolutionV1Wizard";
import type { ElectronSolutionBridge, SolutionSource } from "../features/solution/solutionLoader";
import { useModelEditor } from "../features/model/ModelEditorContext";
import { useGenerator } from "../features/generator/GeneratorContext";
import { useConfirm } from "../shared/hooks/useConfirm";
import { useModelActions } from "../features/model/hooks/useModelActions";
import { useResizablePane } from "../features/layout/useResizablePane";
import { buildTree, detectBaseType, getFolderMeta, indexFolderEntities, normalizeFolderPath, resolveFolderInheritance } from "../features/model/model-utils";
import { folderLocatorFromFolderPath, modelLocatorFromRelPath } from "../features/model/locator-utils";
import { collectZoneFolderDeletes, collectZoneFolderRenames } from "../features/model/refactor/baseSaveEffects";
import {
  applyPropertyRefactorToBaseEntities,
  applyPropertyRefactorToFolderEntities,
  applyPropertyRefactorToModelEntities,
  summarizePropertyRefactorImpact,
} from "../features/model/refactor/applyPropertyRefactor";
import { createPropertyRefactorPayload, diffPropertyChanges, diffPropertyValueChanges } from "../features/model/refactor/propertyRefactor";
import {
  buildPropertyScopeTargetIndex,
  type PropertyRefactorScopeTarget,
  type SupportedBaseScopeTarget,
} from "../features/model/refactor/propertyRefactorScopes";
import type { PluginManifest } from "../features/model/generated-schema-types.ts";
import type { BaseAttributeType, BaseDataProduct, BaseDataTypeDefinition, BaseEntity, BaseZone, EntityWrapper, FolderEntity, ModelEntity, Tab } from "../features/model/model-types";
import { buildPropertyOptionsFromBaseEntities } from "../features/model/property-options";
import { apiBase } from "../config";
import { deepEqual } from "../shared/utils/deepEqual";
import { humanize, toLower } from "../shared/utils/strings";
import { config, isBrowserLike, isElectronMode, shouldUseServerDialog, syncConfigFromServer, type RuntimeAppMode } from "../config";
import { createEntity, deleteEntity, moveEntities, patchEntity, renameEntity, saveModel } from "../shared/api/v2Client";
import { ErrorSurfaceHost, InfoSurfaceHost, useErrorSurface } from "../shared/ui/ErrorSurface";
import { subscribeAppErrors } from "../shared/ui/appErrorBridge";
import { refresh as refreshConnectorCatalog } from "../shared/connectors/connectorCatalog";

type BaseEntityUpdater = (content: BaseEntity["content"]) => BaseEntity["content"];
type PendingBaseAction =
  | {
    kind: "renameFolder";
    fromFolder: string;
    toFolder: string;
    sourceRelPath: string;
    reason: "zones" | "folderProperties";
  }
  | {
    kind: "deleteFolderTree";
    folderPath: string;
    sourceRelPath: string;
    reason: "zones";
  }
  | {
    kind: "propertyRefactor";
    payload: Partial<PropertyRefactorPayload>;
    targets: PropertyRefactorScopeTarget[];
    sourceRelPath: string;
    preview?: string;
  };

type SaveNotificationStatus = "saved" | "bulk-saved" | "failed";
type SaveNotification = { status: SaveNotificationStatus; label: string };
type BaseSaveResult = { notificationStatus?: Extract<SaveNotificationStatus, "saved" | "bulk-saved"> };
type BulkDraftCleanup = {
  baseRelPaths?: string[];
  entityRelPaths?: string[];
  sourceBaseRelPath?: string | null;
  sourceEntityRelPath?: string | null;
};
type PropertyRefactorRunResult = {
  modelEntities: number;
  folderEntities: number;
  baseEntities: number;
  changeCount: number;
  updatedModelRelPaths: string[];
  updatedBaseRelPaths: string[];
  updatedFolderPaths: string[];
};

const buildBaseEntityLocator = (entityType: string, item: Record<string, unknown>): string | null => {
  if (entityType === "propertyValues") {
    const property = `${item?.property ?? ""}`.trim();
    const name = `${item?.name ?? ""}`.trim();
    if (!property || !name) return null;
    return `/propertyValues/${property}/${name}`;
  }

  const name = `${item?.name ?? ""}`.trim();
  if (!name) return null;
  return `/${entityType}/${name}`;
};

const getBaseIdentityKey = (entityType: string, item: Record<string, unknown>): string | null => {
  if (entityType === "propertyValues") {
    const property = `${item?.property ?? ""}`.trim();
    const name = `${item?.name ?? ""}`.trim();
    if (!property || !name) return null;
    return `${property}::${name}`;
  }
  const name = `${item?.name ?? ""}`.trim();
  return name || null;
};

const assertNoDuplicateBaseKeys = (entityType: string, items: unknown[]): void => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const raw of items) {
    const item = (raw || {}) as Record<string, unknown>;
    const key = getBaseIdentityKey(entityType, item);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  if (duplicates.size > 0) {
    const list = Array.from(duplicates).join(", ");
    throw new Error(
      `Cannot save ${entityType}: duplicate keys detected (${list}). The v2 /entities locator is not unique for these items.`,
    );
  }
};

const persistBaseListItems = async (
  baseType: string,
  prevItems: unknown[],
  nextItems: unknown[],
  opts?: { save?: boolean },
): Promise<boolean> => {
  let hadMutation = false;
  const previousByKey = new Map<string, Record<string, unknown>>();
  for (const item of prevItems) {
    const locator = buildBaseEntityLocator(baseType, item as Record<string, unknown>);
    if (!locator) continue;
    previousByKey.set(locator, item as Record<string, unknown>);
  }

  for (const [index, item] of nextItems.entries()) {
    const nextItem = item as Record<string, unknown>;
    const locator = buildBaseEntityLocator(baseType, nextItem);
    if (!locator) continue;
    const prevItem = previousByKey.get(locator);
    if (prevItem) {
      if (!deepEqual(prevItem, nextItem)) {
        await patchEntity(locator, nextItem, opts);
        hadMutation = true;
      }
      previousByKey.delete(locator);
      continue;
    }

    const indexedPrevious = prevItems.length === nextItems.length ? (prevItems[index] as Record<string, unknown> | undefined) : undefined;
    const previousLocator = indexedPrevious ? buildBaseEntityLocator(baseType, indexedPrevious) : null;
    if (previousLocator && previousLocator !== locator && previousByKey.has(previousLocator)) {
      await renameEntity(previousLocator, locator, nextItem, opts);
      previousByKey.delete(previousLocator);
      hadMutation = true;
      continue;
    }

    try {
      await createEntity(locator, nextItem, opts);
      hadMutation = true;
    } catch {
      await patchEntity(locator, nextItem, opts);
      hadMutation = true;
    }
  }

  for (const [locator] of previousByKey) {
    await deleteEntity(locator, opts);
    hadMutation = true;
  }

  return hadMutation;
};

const buildTopLevelEntityPatch = (
  previousContent: Record<string, unknown>,
  nextContent: Record<string, unknown>,
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  const keys = new Set<string>([
    ...Object.keys(previousContent || {}),
    ...Object.keys(nextContent || {}),
  ]);
  for (const key of keys) {
    const prevValue = previousContent?.[key];
    const nextValue = nextContent?.[key];
    if (!deepEqual(prevValue, nextValue)) {
      patch[key] = nextValue;
    }
  }
  return patch;
};

const uniqueScopeTargets = (targets: PropertyRefactorScopeTarget[]): PropertyRefactorScopeTarget[] =>
  Array.from(new Set(targets));

export function AppShell() {
  const {
    solution,
    solutionSource,
    solutionPath,
    loading: solutionLoading,
    error,
    migrationOpen,
    migrationSourcePath,
    pickerOpen,
    pickerInput,
    setPickerOpen,
    setPickerInput,
    setPickerError,
    clearError: clearSolutionError,
    loadSolution,
  } = useSolution();
  const [appMode, setAppMode] = useState<RuntimeAppMode>(config.mode);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargets, setMoveTargets] = useState<string[]>([]);
  const [moveFolderPath, setMoveFolderPath] = useState("");
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderParentPath, setNewFolderParentPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [dirtyFolderPaths, setDirtyFolderPaths] = useState<Set<string>>(new Set());
  const [baseItemSelectionRequest, setBaseItemSelectionRequest] = useState<{
    relPath: string;
    itemName: string;
    token: number;
  } | null>(null);
  const [projectRootHint, setProjectRootHint] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const entityPersistRef = useRef<(() => Promise<boolean>) | null>(null);
  const basePersistRef = useRef<(() => Promise<boolean>) | null>(null);
  const folderPersistRef = useRef<(() => Promise<boolean>) | null>(null);
  const patchedBasePayloadRef = useRef<Map<string, { next: BaseEntity; previousContent: BaseEntity["content"] }>>(new Map());
  const patchedBaseTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const patchedBaseInFlightRef = useRef<Set<string>>(new Set());
  const patchedBaseQueuedRef = useRef<Set<string>>(new Set());
  const {
    modelEntities,
    baseEntities,
    folderEntities,
    setModelEntities,
    setBaseEntities,
    setFolderEntities,
    tabs,
    activeTab,
    expanded,
    setExpanded,
    treeFilter,
    setTreeFilter,
    modelTabs,
    baseTabs,
    setModelTabs,
    setBaseTabs,
    activeWorkTab,
    setActiveWorkTab,
    collapsedGroups,
    toggleGroup,
    selectedRelPath,
    setSelectedRelPath,
    selectedFolderPath,
    setSelectedFolderPath,
    setSelectedRelPaths,
    selectedRelPaths,
    toggleEntitySelection,
    selectedBaseRelPath,
    setSelectedBaseRelPath,
    selectedEntity,
    selectedBase,
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    openModelTab,
    openBaseTab,
    focusEntityTab,
    focusBaseTab,
    closeTab,
    closeAllTabs,
    setTabDirty,
    anyDirty,
    getEntityDraft,
    setEntityDraft,
    getBaseDraft,
    setBaseDraft,
    clearAllDrafts,
  } = useModelEditor();
  const [saveNotification, setSaveNotification] = useState<SaveNotification | null>(null);
  const saveNotificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSaveNotification = useCallback((status: SaveNotificationStatus) => {
    if (saveNotificationTimerRef.current) {
      clearTimeout(saveNotificationTimerRef.current);
    }
    setSaveNotification({
      status,
      label: status === "failed" ? "Save failed" : "Saved",
    });
    saveNotificationTimerRef.current = setTimeout(() => {
      setSaveNotification(null);
      saveNotificationTimerRef.current = null;
    }, 2000);
  }, []);
  const clearDraftsForBulkSave = useCallback(
    ({ baseRelPaths = [], entityRelPaths = [], sourceBaseRelPath = null, sourceEntityRelPath = null }: BulkDraftCleanup) => {
      Array.from(new Set(baseRelPaths))
        .filter((relPath) => relPath && relPath !== sourceBaseRelPath)
        .forEach((relPath) => setBaseDraft(relPath, null));
      Array.from(new Set(entityRelPaths))
        .filter((relPath) => relPath && relPath !== sourceEntityRelPath)
        .forEach((relPath) => setEntityDraft(relPath, null));
    },
    [setBaseDraft, setEntityDraft],
  );
  const { duplicateModelEntities, deleteModelEntities } = useModelActions({
    onSaveNotification: showSaveNotification,
    onBulkDraftCleanup: clearDraftsForBulkSave,
  });
  const { resolvedTheme, setTheme } = useTheme();
  const isWindowsElectron = window.desktop?.isElectron && window.desktop?.platform === "win32";
  const {
    generatorTarget,
    generatorTargets,
    generatorLog,
    generatorStderr,
    generatorError,
    generatorRunning,
    generatorLogLevel,
    setGeneratorTarget,
    setGeneratorLogLevel,
    runGenerator,
    runValidation,
  } = useGenerator();
  const [activeRunPanel, setActiveRunPanel] = useState<"generator" | null>(null);
  const [globalRefreshOpen, setGlobalRefreshOpen] = useState(false);
  const [windowTitle, setWindowTitle] = useState("DataM8");
  const [windowMenuLabels, setWindowMenuLabels] = useState<string[]>([]);
  const { showError } = useErrorSurface();
  const confirm = useConfirm();
  const { width: sidebarSize, setWidth: setSidebarSize, startResize } = useResizablePane({
    initialWidth: sidebarWidth,
    onChange: setSidebarWidth,
  });

  useEffect(() => {
    setSidebarSize(sidebarWidth);
  }, [setSidebarSize, sidebarWidth]);

  useEffect(() => {
    return () => {
      if (saveNotificationTimerRef.current) {
        clearTimeout(saveNotificationTimerRef.current);
      }
    };
  }, []);

  const showAppError = useCallback(
    (title: string, description?: string, onRetry?: (() => void) | null) => {
      showError("app", { title, description, onRetry: onRetry || null, retryLabel: "Retry" });
    },
    [showError],
  );

  useEffect(() => {
    return subscribeAppErrors((event) => {
      showAppError(event.title, event.description || undefined);
    });
  }, [showAppError]);

  useEffect(() => {
    (async () => {
      if ((window as any)?.desktop?.isElectron === true) {
        setAppMode("electron");
        return;
      }
      const cfg = await syncConfigFromServer();
      setAppMode(cfg.mode);
    })();
  }, []);

  useEffect(() => {
    if (error) {
      showAppError("Failed to load solution", error);
    }
  }, [error, showAppError]);

  useEffect(() => {
    const stored = localStorage.getItem("dm8_solution_path");
    if (stored) {
      const parts = stored.split(/[\\/]/).slice(0, -1);
      setProjectRootHint(parts.join("/"));
    }
  }, []);

  useEffect(() => {
    if (solutionPath) {
      const parts = solutionPath.split(/[\\/]/).slice(0, -1);
      setProjectRootHint(parts.join("/"));
    }
  }, [solutionPath]);

  useEffect(() => {
    if (!window.desktop?.isElectron || !window.desktop?.window?.setSolutionPath) return;
    void window.desktop.window.setSolutionPath(solutionPath || null);
  }, [solutionPath]);

  const selectedRelPathRef = useRef<string | null>(selectedRelPath);
  useEffect(() => {
    selectedRelPathRef.current = selectedRelPath;
  }, [selectedRelPath]);

  const browserLike = isBrowserLike(appMode);
  const electronLike = isElectronMode(appMode);
  const serverDialog = shouldUseServerDialog(appMode);

  const applyLoadedSolution = useCallback(
    (
      result?: { modelEntities: ModelEntity[]; baseEntities: BaseEntity[]; folderEntities?: FolderEntity[] } | null,
      options?: { resetWorkspace?: boolean },
    ) => {
      if (!result) return;
      if (options?.resetWorkspace) {
        closeAllTabs();
      }
      clearAllDrafts();
      setModelEntities(result.modelEntities);
      setBaseEntities(result.baseEntities);
      setFolderEntities(result.folderEntities || []);
      setDirtyFolderPaths(new Set());
      patchedBaseTimerRef.current.forEach((timer) => clearTimeout(timer));
      patchedBaseTimerRef.current.clear();
      patchedBasePayloadRef.current.clear();
      patchedBaseInFlightRef.current.clear();
      patchedBaseQueuedRef.current.clear();
      setBaseItemSelectionRequest(null);
      setSelectedFolderPath(null);
    },
    [clearAllDrafts, closeAllTabs, setBaseEntities, setFolderEntities, setModelEntities, setSelectedFolderPath],
  );

  const formatBaseTitle = useCallback((name: string) => {
    const baseName = (name || "").replace(/\.json$/i, "");
    const normalized = toLower(baseName).replace(/[\s_]/g, "");
    if (normalized.includes("attributetypes")) return "Attribute Types";
    if (normalized.includes("datatypes")) return "Data Types";
    if (normalized.includes("datasources")) return "Data Sources";
    if (normalized.includes("datasourcetypes")) return "Data Source Types";
    if (normalized.includes("dataproducts")) return "Data Products";
    if (normalized.includes("propertyvalues")) return "Property Values";
    return humanize(baseName);
  }, []);

  const clearPatchedBaseTimer = useCallback((relPath: string) => {
    const handle = patchedBaseTimerRef.current.get(relPath);
    if (handle) {
      clearTimeout(handle);
      patchedBaseTimerRef.current.delete(relPath);
    }
  }, []);

  const flushPatchedBaseAutosave = useCallback(
    async (relPath: string) => {
      const pending = patchedBasePayloadRef.current.get(relPath);
      if (!pending) return;
      if (patchedBaseInFlightRef.current.has(relPath)) {
        patchedBaseQueuedRef.current.add(relPath);
        return;
      }
      patchedBaseInFlightRef.current.add(relPath);
      try {
        const nextEntity = pending.next;
        let hadMutation = false;
        const detectedUpdated = detectBaseType(nextEntity.content, nextEntity.relPath);
        const detectedPrevious = detectBaseType(pending.previousContent || {}, nextEntity.relPath);
        const baseType = detectedUpdated.type !== "unknown" ? detectedUpdated.type : detectedPrevious.type;
        const nextItems = Array.isArray(detectedUpdated.items) ? detectedUpdated.items : [];
        const prevItems = Array.isArray(detectedPrevious.items) ? detectedPrevious.items : [];

        if (baseType && baseType !== "unknown") {
          assertNoDuplicateBaseKeys(baseType, nextItems);
          hadMutation = await persistBaseListItems(baseType, prevItems, nextItems, { save: false });
        } else {
          const locator = nextEntity.locator || modelLocatorFromRelPath(nextEntity.relPath);
          try {
            await patchEntity(locator, nextEntity.content as Record<string, unknown>, { save: false });
            hadMutation = true;
          } catch {
            await createEntity(locator, nextEntity.content as Record<string, unknown>, { save: false });
            hadMutation = true;
          }
        }
        if (hadMutation) {
          await saveModel();
        }
        setBaseTabs((tabs) =>
          tabs.map((t) =>
            t.relPath === nextEntity.relPath
              ? { ...t, dirty: false, title: formatBaseTitle(nextEntity.name || nextEntity.relPath.split("/").pop() || nextEntity.relPath) }
              : t,
          ),
        );
        setTabDirty(nextEntity.relPath, "base", false);
        console.log(`[DataM8] Base entity autosaved: ${nextEntity.relPath}`);
        showSaveNotification("saved");
      } catch (err) {
        console.error("[DataM8] Base entity autosave failed:", err);
        setTabDirty(relPath, "base", true);
        setBaseTabs((tabs) =>
          tabs.map((t) => (t.relPath === relPath ? { ...t, dirty: true } : t)),
        );
        showSaveNotification("failed");
      } finally {
        patchedBaseInFlightRef.current.delete(relPath);
        if (patchedBaseQueuedRef.current.has(relPath)) {
          patchedBaseQueuedRef.current.delete(relPath);
          clearPatchedBaseTimer(relPath);
          const timer = setTimeout(() => {
            void flushPatchedBaseAutosave(relPath);
          }, 0);
          patchedBaseTimerRef.current.set(relPath, timer);
        }
      }
    },
    [clearPatchedBaseTimer, formatBaseTitle, setBaseTabs, setTabDirty, showSaveNotification],
  );

  const schedulePatchedBaseAutosave = useCallback(
    (entry: BaseEntity, previousContent: BaseEntity["content"]) => {
      patchedBasePayloadRef.current.set(entry.relPath, { next: entry, previousContent });
      clearPatchedBaseTimer(entry.relPath);
      const timer = setTimeout(() => {
        void flushPatchedBaseAutosave(entry.relPath);
      }, 0);
      patchedBaseTimerRef.current.set(entry.relPath, timer);
    },
    [clearPatchedBaseTimer, flushPatchedBaseAutosave],
  );

  useEffect(() => {
    const timerMap = patchedBaseTimerRef.current;
    const payloadMap = patchedBasePayloadRef.current;
    const inFlightSet = patchedBaseInFlightRef.current;
    const queuedSet = patchedBaseQueuedRef.current;
    return () => {
      timerMap.forEach((timer) => clearTimeout(timer));
      timerMap.clear();
      payloadMap.clear();
      inFlightSet.clear();
      queuedSet.clear();
    };
  }, []);

  const onPatchBaseEntity = useCallback(
    (relPath: string, updater: BaseEntityUpdater) => {
      const baseEntry = baseEntities.find((b) => b.relPath === relPath);
      if (!baseEntry) return;
      const nextContent = updater(baseEntry.content);
      if (deepEqual(nextContent, baseEntry.content)) return;
      const detectedType = detectBaseType(nextContent, relPath).type;
      const pendingEntry: BaseEntity = { ...baseEntry, content: nextContent };

      // Keep "previous" base content intact for explicit save diff/refactor handling.
      // For Properties and PropertyValues we only mark dirty and let the editor draft hold edits.
      if (detectedType !== "properties" && detectedType !== "propertyValues") {
        setBaseEntities((prev) =>
          prev.map((b) => (b.relPath === relPath ? pendingEntry : b)),
        );
      }

      const title = formatBaseTitle(baseEntry?.name || relPath.split("/").pop() || relPath);
      setBaseTabs((tabs) =>
        tabs.some((t) => t.relPath === relPath)
          ? tabs.map((t) => (t.relPath === relPath ? { ...t, dirty: true } : t))
          : [...tabs, { relPath, title, dirty: true }],
      );
      if (detectedType === "properties" || detectedType === "propertyValues") {
        setTabDirty(relPath, "base", true);
        return;
      }
      schedulePatchedBaseAutosave(pendingEntry, baseEntry.content);
    },
    [baseEntities, formatBaseTitle, schedulePatchedBaseAutosave, setBaseEntities, setBaseTabs, setTabDirty],
  );

  const dataTypes = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataTypes");
    const list: string[] =
      (entry?.content?.dataTypes || entry?.content?.datatypes || [])
        .map((d: BaseDataTypeDefinition) => d.name)
        .filter(Boolean) || [];
    return list;
  }, [baseEntities]);

  const dataTypeDefinitions = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataTypes");
    const defs: Record<string, { hasCharLen?: boolean; hasPrecision?: boolean; hasScale?: boolean }> = {};
    (entry?.content?.dataTypes || entry?.content?.datatypes || []).forEach((dt: BaseDataTypeDefinition) => {
      if (dt?.name) {
        defs[dt.name] = {
          hasCharLen: !!dt.hasCharLen,
          hasPrecision: !!dt.hasPrecision,
          hasScale: !!dt.hasScale,
        };
      }
    });
    return defs;
  }, [baseEntities]);

  const zoneColors = useMemo(() => ["#002855", "#004085", "#70465a", "#ba0c2f"], []);
  const zoneLabelForTab = useCallback((relPath: string) => {
    const parts = (relPath || "").split("/");
    const zone = parts[1] || "General";
    return humanize(zone) || "General";
  }, []);
  const groupedModelTabs = useMemo(() => {
    const byZone: Record<string, typeof modelTabs> = {};
    const order: string[] = [];
    modelTabs.forEach((t) => {
      const zone = zoneLabelForTab(t.relPath);
      if (!byZone[zone]) {
        byZone[zone] = [];
        order.push(zone);
      }
      byZone[zone].push(t);
    });
    return order.map((zone, idx) => ({
      zone,
      tabs: byZone[zone],
      color: zoneColors[idx % zoneColors.length],
    }));
  }, [modelTabs, zoneColors, zoneLabelForTab]);

  const modelZones = useMemo(
    () => Array.from(new Set(modelEntities.map((m) => ((m.relPath || "").split("/")[1] || "").trim()).filter(Boolean))),
    [modelEntities],
  );
  const dataProductsBase = useMemo(
    () => baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataProducts"),
    [baseEntities],
  );
  const propertiesEntry = useMemo(
    () => baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "properties"),
    [baseEntities],
  );
  const propertyScopeTargetsByName = useMemo(
    () => buildPropertyScopeTargetIndex(propertiesEntry?.content || {}),
    [propertiesEntry?.content],
  );

  const productOptions = useMemo(() => {
    if (!dataProductsBase) return [];
    const products = dataProductsBase.content?.dataProducts || [];
    return products
      .map((p: BaseDataProduct) => (p?.name || "").trim())
      .filter(Boolean)
      .filter((value: string, idx: number, arr: string[]) => arr.indexOf(value) === idx)
      .sort((a: string, b: string) => a.localeCompare(b));
  }, [dataProductsBase]);

  const moduleOptionsByProduct = useMemo(() => {
    if (!dataProductsBase) return {};
    const record: Record<string, string[]> = {};
    const products = dataProductsBase.content?.dataProducts || [];
    products.forEach((p: BaseDataProduct) => {
      const name = (p?.name || "").trim();
      if (!name) return;
      const modules = (p?.dataModules || [])
        .map((m) => (m?.name || "").trim())
        .filter((value: string): value is string => typeof value === "string" && value.trim() !== "");
      record[name] = Array.from(new Set<string>(modules)).sort((a, b) => a.localeCompare(b));
    });
    return record;
  }, [dataProductsBase]);

  const ensureExpandedPath = useCallback(
    (path: string) => {
      const parts = path.split("/").filter(Boolean);
      setExpanded((prev) => {
        const next = new Set(prev);
        let acc = "";
        parts.forEach((p) => {
          acc = acc ? `${acc}/${p}` : p;
          next.add(acc);
        });
        return next;
      });
    },
    [setExpanded],
  );

  const openMoveDialog = useCallback((relPaths: string[]) => {
    if (!relPaths.length) return;
    setMoveTargets(relPaths);
    const normalized = relPaths[0].split(/[\\/]/).join("/");
    const parts = normalized.split("/").filter(Boolean);
    const withoutRoot = parts[0] === "Model" ? parts.slice(1) : parts;
    setMoveFolderPath(normalizeFolderPath(withoutRoot.slice(0, -1).join("/")));
    setMoveDialogOpen(true);
  }, []);

  const handleMoveDialogOpenChange = useCallback((open: boolean) => {
    setMoveDialogOpen(open);
    if (!open) {
      setMoveTargets([]);
      setMoveFolderPath("");
    }
  }, []);

  const zoneFolderPaths = useMemo(() => {
    const zonesEntry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "zones");
    const zones = zonesEntry?.content?.zones || [];
    return zones
      .map((zone: BaseZone) => normalizeFolderPath(zone?.localFolderName || ""))
      .filter((path: string) => !!path);
  }, [baseEntities]);

  const tree = useMemo(() => buildTree(modelEntities, folderEntities, zoneFolderPaths), [folderEntities, modelEntities, zoneFolderPaths]);

  useEffect(() => {
    if (tree.length && expanded.size === 0) {
      const initial = new Set<string>();
      tree.forEach((n) => n.path && initial.add(n.path));
      setExpanded(initial);
    }
  }, [tree, expanded.size, setExpanded]);

  useEffect(() => {
    (async () => {
      if (solution) return;
      const stored = localStorage.getItem("dm8_solution_path") || "";
      if (stored) {
        setPickerInput(stored);
      }

      clearSolutionError();
    })();
  }, [clearSolutionError, serverDialog, setPickerError, setPickerInput, solution]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const result = await loadSolution({ kind: "uploaded-file", file });
      if (result) applyLoadedSolution(result, { resetWorkspace: true });
      event.target.value = "";
    },
    [applyLoadedSolution, loadSolution],
  );

  const pickElectronSolution = useCallback(async () => {
    // Use the new window.desktop bridge
    if (window.desktop?.solution?.pickOpenPath) {
      const path = await window.desktop.solution.pickOpenPath();
      if (!path) return;
      const result = await loadSolution({ kind: "electron-path", path });
      if (result) applyLoadedSolution(result, { resetWorkspace: true });
      return;
    }

    // Fallback or legacy check
    const bridge: ElectronSolutionBridge | undefined = window.electron;
    if (!bridge?.pickSolutionFile) {
      setPickerError("Electron picker is not available");
      return;
    }
    const selection = await bridge.pickSolutionFile();
    const path = typeof selection === "string" ? selection : selection?.path;
    if (!path) return;
    const result = await loadSolution({ kind: "electron-path", path });
    if (result) applyLoadedSolution(result, { resetWorkspace: true });
  }, [applyLoadedSolution, loadSolution, setPickerError]);

  const triggerSolutionSelect = useCallback(
    async (resetInput: boolean) => {
      if (browserLike) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
          fileInputRef.current.click();
        }
        return;
      }
      if (electronLike) {
        await pickElectronSolution();
        return;
      }
      if (resetInput) {
        setPickerInput("");
      }
      if (serverDialog) {
        setPickerOpen(true);
      }
    },
    [browserLike, electronLike, pickElectronSolution, serverDialog, setPickerInput, setPickerOpen],
  );

  const handleProjectCreated = useCallback(
    async (createdSolutionPath: string) => {
      const result = await loadSolution({ kind: "server-path", path: createdSolutionPath });
      if (!result) {
        throw new Error("Failed to load created solution");
      }
      applyLoadedSolution(result);
      setNewProjectOpen(false);
    },
    [applyLoadedSolution, loadSolution],
  );

  const handleToggle = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [setExpanded],
  );

  const handleSave = useCallback(
    async (updated: ModelEntity) => {
      const fromRelPath = updated.relPath;
      const nextEntityName = `${updated.content?.name ?? updated.name ?? ""}`.trim();
      const relPathParts = fromRelPath.split("/");
      const currentFileName = relPathParts[relPathParts.length - 1] || "";
      const extension = currentFileName.toLowerCase().endsWith(".json") ? ".json" : "";
      const currentStem = extension ? currentFileName.slice(0, -extension.length) : currentFileName;
      const renameRequested = Boolean(nextEntityName && extension && currentStem !== nextEntityName);
      const toRelPath = renameRequested
        ? [...relPathParts.slice(0, -1), `${nextEntityName}${extension}`].join("/")
        : fromRelPath;
      try {
        await patchEntity(modelLocatorFromRelPath(fromRelPath), updated.content as Record<string, unknown>);
        if (renameRequested) {
          await moveEntities(modelLocatorFromRelPath(fromRelPath), modelLocatorFromRelPath(toRelPath));
        }
        const persisted: ModelEntity = {
          ...updated,
          name: nextEntityName || updated.name,
          relPath: toRelPath,
          locator: modelLocatorFromRelPath(toRelPath),
        };
        setModelEntities((list) => list.map((m) => (m.relPath === fromRelPath ? persisted : m)));
        setModelTabs((tabs) =>
          tabs.map((t) =>
            t.relPath === fromRelPath
              ? {
                ...t,
                relPath: toRelPath,
                dirty: false,
                title: persisted.name,
              }
              : t,
          ),
        );
        if (selectedRelPath === fromRelPath) {
          setSelectedRelPath(toRelPath);
        }
        setSelectedRelPaths((prev) => {
          if (!prev.has(fromRelPath)) return prev;
          const next = new Set(prev);
          next.delete(fromRelPath);
          next.add(toRelPath);
          return next;
        });
        if (activeWorkTab === `entity:${fromRelPath}`) {
          setActiveWorkTab(`entity:${toRelPath}`);
        }
        setTabDirty(toRelPath, "entity", false);
      } catch (err) {
        setTabDirty(fromRelPath, "entity", true);
        throw err;
      }
    },
    [
      activeWorkTab,
      selectedRelPath,
      setActiveWorkTab,
      setModelEntities,
      setModelTabs,
      setSelectedRelPath,
      setSelectedRelPaths,
      setTabDirty,
    ],
  );

  const renameModelFolder = useCallback(
    async (fromFolder: string, toFolder: string) => {
      if (!fromFolder || !toFolder || fromFolder === toFolder) return;
      const fromFolderPath = normalizeFolderPath(fromFolder.replace(/^Model\/?/, ""));
      const toFolderPath = normalizeFolderPath(toFolder.replace(/^Model\/?/, ""));

      await moveEntities(folderLocatorFromFolderPath(fromFolderPath), folderLocatorFromFolderPath(toFolderPath));
      setModelEntities((prev) =>
        prev.map((m) => {
          if (!m.relPath.startsWith(fromFolder)) return m;
          const relPath = m.relPath.replace(fromFolder, toFolder);
          return { ...m, relPath, locator: modelLocatorFromRelPath(relPath) };
        }),
      );
      setModelTabs((prev) => prev.map((t) => (t.relPath.startsWith(fromFolder) ? { ...t, relPath: t.relPath.replace(fromFolder, toFolder) } : t)));
      setFolderEntities((prev) =>
        prev.map((entry) => {
          const currentPath = normalizeFolderPath(entry.folderPath || "");
          if (!(currentPath === fromFolderPath || currentPath.startsWith(`${fromFolderPath}/`))) return entry;
          const nextFolderPath = currentPath === fromFolderPath
            ? toFolderPath
            : `${toFolderPath}/${currentPath.slice(fromFolderPath.length + 1)}`;
          const nextRelPath = `Model/${nextFolderPath}/.properties.json`;
          const nextName = nextFolderPath.split("/").filter(Boolean).pop() || entry.name;
          return {
            ...entry,
            folderPath: nextFolderPath,
            relPath: nextRelPath,
            name: currentPath === fromFolderPath ? nextName : entry.name,
            content: {
              ...(entry.content || {}),
              path: nextFolderPath,
              ...(currentPath === fromFolderPath ? { name: nextName } : null),
            },
          };
        }),
      );
      setDirtyFolderPaths((prev) => {
        const next = new Set<string>();
        prev.forEach((path) => {
          const normalizedPath = normalizeFolderPath(path);
          if (normalizedPath === fromFolderPath) {
            next.add(toFolderPath);
            return;
          }
          if (normalizedPath.startsWith(`${fromFolderPath}/`)) {
            next.add(`${toFolderPath}/${normalizedPath.slice(fromFolderPath.length + 1)}`);
            return;
          }
          next.add(normalizedPath);
        });
        return next;
      });
      {
        const normalizedSelectedFolderPath = normalizeFolderPath(selectedFolderPath || "");
        if (normalizedSelectedFolderPath === fromFolderPath) {
          setSelectedFolderPath(toFolderPath);
        } else if (normalizedSelectedFolderPath.startsWith(`${fromFolderPath}/`)) {
          setSelectedFolderPath(`${toFolderPath}/${normalizedSelectedFolderPath.slice(fromFolderPath.length + 1)}`);
        }
      }
      const currentSelectedRelPath = selectedRelPathRef.current;
      setSelectedRelPath(
        currentSelectedRelPath && currentSelectedRelPath.startsWith(fromFolder)
          ? currentSelectedRelPath.replace(fromFolder, toFolder)
          : currentSelectedRelPath,
      );
      setSelectedRelPaths((prev) => {
        const next = new Set<string>();
        prev.forEach((p) => next.add(p.startsWith(fromFolder) ? p.replace(fromFolder, toFolder) : p));
        return next;
      });
      setActiveWorkTab((prev) => {
        if (prev?.startsWith(`entity:${fromFolder}`)) return prev.replace(fromFolder, toFolder);
        if (prev?.startsWith(`folder:${fromFolderPath}`)) return prev.replace(`folder:${fromFolderPath}`, `folder:${toFolderPath}`);
        return prev;
      });
    },
    [
      selectedFolderPath,
      setActiveWorkTab,
      setDirtyFolderPaths,
      setFolderEntities,
      setModelEntities,
      setModelTabs,
      setSelectedFolderPath,
      setSelectedRelPath,
      setSelectedRelPaths,
    ],
  );

  const runPropertyRefactor = useCallback(
    async (changes: Partial<PropertyRefactorPayload>, targets: PropertyRefactorScopeTarget[]): Promise<PropertyRefactorRunResult> => {
      const payload = createPropertyRefactorPayload(changes);
      if (!payload || targets.length === 0) {
        return {
          modelEntities: 0,
          folderEntities: 0,
          baseEntities: 0,
          changeCount: 0,
          updatedModelRelPaths: [],
          updatedBaseRelPaths: [],
          updatedFolderPaths: [],
        };
      }
      const targetSet = new Set<PropertyRefactorScopeTarget>(targets);
      const baseTargets = targets.filter(
        (target): target is SupportedBaseScopeTarget => target !== "entity" && target !== "folder",
      );

      const modelResult = targetSet.has("entity")
        ? applyPropertyRefactorToModelEntities(modelEntities, payload)
        : { updatedEntities: [] as ModelEntity[], changeCount: 0 };
      const folderResult = targetSet.has("folder")
        ? applyPropertyRefactorToFolderEntities(folderEntities, payload)
        : { updatedEntities: [] as FolderEntity[], changeCount: 0 };
      const baseResult = baseTargets.length
        ? applyPropertyRefactorToBaseEntities(baseEntities, payload, baseTargets)
        : { updatedEntities: [] as BaseEntity[], changeCount: 0 };

      if (
        modelResult.updatedEntities.length === 0 &&
        folderResult.updatedEntities.length === 0 &&
        baseResult.updatedEntities.length === 0
      ) {
        return {
          modelEntities: 0,
          folderEntities: 0,
          baseEntities: 0,
          changeCount: 0,
          updatedModelRelPaths: [],
          updatedBaseRelPaths: [],
          updatedFolderPaths: [],
        };
      }

      const currentByRelPath = new Map(modelEntities.map((entity) => [entity.relPath, entity]));
      for (const entity of modelResult.updatedEntities) {
        const previous = currentByRelPath.get(entity.relPath);
        const patch = buildTopLevelEntityPatch(
          (previous?.content || {}) as Record<string, unknown>,
          (entity.content || {}) as Record<string, unknown>,
        );
        if (Object.keys(patch).length === 0) continue;
        await patchEntity(modelLocatorFromRelPath(entity.relPath), patch);
      }

      const currentFoldersByPath = new Map(
        folderEntities.map((entry) => [normalizeFolderPath(entry.folderPath || ""), entry]),
      );
      for (const entry of folderResult.updatedEntities) {
        const folderPath = normalizeFolderPath(entry.folderPath || "");
        const previous = currentFoldersByPath.get(folderPath);
        const patch = buildTopLevelEntityPatch(
          (previous?.content || {}) as Record<string, unknown>,
          (entry.content || {}) as Record<string, unknown>,
        );
        if (Object.keys(patch).length === 0) continue;
        await patchEntity(folderLocatorFromFolderPath(folderPath), patch);
      }

      for (const updatedBase of baseResult.updatedEntities) {
        const previousBase = baseEntities.find((entry) => entry.relPath === updatedBase.relPath);
        if (!previousBase) continue;
        const detectedUpdated = detectBaseType(updatedBase.content, updatedBase.relPath);
        const detectedPrevious = detectBaseType(previousBase.content || {}, previousBase.relPath);
        const baseType = detectedUpdated.type !== "unknown" ? detectedUpdated.type : detectedPrevious.type;
        if (!baseType || baseType === "unknown") continue;

        const nextItems = Array.isArray(detectedUpdated.items) ? detectedUpdated.items : [];
        const prevItems = Array.isArray(detectedPrevious.items) ? detectedPrevious.items : [];
        assertNoDuplicateBaseKeys(baseType, nextItems);
        await persistBaseListItems(baseType, prevItems, nextItems);
      }

      const updatedModelByRelPath = new Map(modelResult.updatedEntities.map((entity) => [entity.relPath, entity]));
      setModelEntities((prev) => prev.map((entity) => updatedModelByRelPath.get(entity.relPath) || entity));

      const updatedFolderByPath = new Map(
        folderResult.updatedEntities.map((entry) => [normalizeFolderPath(entry.folderPath || ""), entry]),
      );
      setFolderEntities((prev) =>
        prev.map((entry) => updatedFolderByPath.get(normalizeFolderPath(entry.folderPath || "")) || entry),
      );

      const updatedBaseByRelPath = new Map(baseResult.updatedEntities.map((entry) => [entry.relPath, entry]));
      setBaseEntities((prev) => prev.map((entry) => updatedBaseByRelPath.get(entry.relPath) || entry));

      void summarizePropertyRefactorImpact(modelResult);
      return {
        modelEntities: modelResult.updatedEntities.length,
        folderEntities: folderResult.updatedEntities.length,
        baseEntities: baseResult.updatedEntities.length,
        changeCount: modelResult.changeCount + folderResult.changeCount + baseResult.changeCount,
        updatedModelRelPaths: modelResult.updatedEntities.map((entity) => entity.relPath),
        updatedBaseRelPaths: baseResult.updatedEntities.map((entry) => entry.relPath),
        updatedFolderPaths: folderResult.updatedEntities.map((entry) => normalizeFolderPath(entry.folderPath || "")),
      };
    },
    [baseEntities, folderEntities, modelEntities, setBaseEntities, setFolderEntities, setModelEntities],
  );

  const deleteFolderTree = useCallback(
    async (
      folderPath: string,
      options?: { confirm?: boolean; allowZoneRoot?: boolean; notifySuccess?: boolean; notifyFailure?: boolean },
    ): Promise<boolean> => {
      const normalizedRaw = normalizeFolderPath(folderPath);
      const normalized = normalizedRaw.replace(/^Model\/?/i, "");
      if (!normalized) return true;
      if (!options?.allowZoneRoot && normalized.split("/").filter(Boolean).length <= 1) {
        showSaveNotification("failed");
        return false;
      }

      const inFolder = (path: string) => path === normalized || path.startsWith(`${normalized}/`);

      const entitiesToDelete = modelEntities.filter((entity) => {
        const rel = normalizeFolderPath(entity.relPath.replace(/^Model\//, "").replace(/\/[^/]+\.json$/i, ""));
        return inFolder(rel);
      });
      const folderMetadataToDelete = folderEntities.filter((entry) => inFolder(normalizeFolderPath(entry.folderPath || "")));

      if (options?.confirm !== false) {
        const proceed = await confirm({
          title: "Delete folder?",
          description: `This deletes folder "${normalized}" including ${entitiesToDelete.length} entity file(s) and ${folderMetadataToDelete.length} folder metadata file(s).`,
          confirmText: "Delete",
          cancelText: "Cancel",
        });
        if (!proceed) return false;
      }

      try {
        for (const entity of entitiesToDelete) {
          await deleteEntity(modelLocatorFromRelPath(entity.relPath));
        }

        const folderMetaSorted = [...folderMetadataToDelete].sort(
          (a, b) => normalizeFolderPath(b.folderPath || "").length - normalizeFolderPath(a.folderPath || "").length,
        );
        for (const folderMeta of folderMetaSorted) {
          await deleteEntity(folderLocatorFromFolderPath(folderMeta.folderPath || ""));
        }

        const deletedRelPaths = new Set(entitiesToDelete.map((entity) => entity.relPath));
        setModelEntities((prev) =>
          prev.filter((entity) => {
            const rel = normalizeFolderPath(entity.relPath.replace(/^Model\//, "").replace(/\/[^/]+\.json$/i, ""));
            return !inFolder(rel);
          }),
        );
        setFolderEntities((prev) => prev.filter((entry) => !inFolder(normalizeFolderPath(entry.folderPath || ""))));
        deletedRelPaths.forEach((relPath) => closeTab("entity", relPath));
        setExpanded((prev) => {
          const next = new Set<string>();
          prev.forEach((path) => {
            if (!inFolder(normalizeFolderPath(path))) next.add(path);
          });
          return next;
        });
        setDirtyFolderPaths((prev) => {
          const next = new Set<string>();
          prev.forEach((path) => {
            if (!inFolder(normalizeFolderPath(path))) next.add(path);
          });
          return next;
        });
        setSelectedRelPaths((prev) => {
          const next = new Set<string>();
          prev.forEach((rel) => {
            if (!deletedRelPaths.has(rel)) next.add(rel);
          });
          return next;
        });
        if (selectedRelPath && deletedRelPaths.has(selectedRelPath)) {
          setSelectedRelPath(null);
        }
        if (selectedFolderPath && inFolder(normalizeFolderPath(selectedFolderPath))) {
          setSelectedFolderPath(null);
          setActiveWorkTab(null);
        }
        if (options?.notifySuccess !== false) {
          showSaveNotification("saved");
        }

        return true;
      } catch (err) {
        if (options?.notifyFailure !== false) {
          console.error("[DataM8] Delete folder failed:", err);
          showSaveNotification("failed");
        }
        throw err;
      }
    },
    [
      closeTab,
      confirm,
      folderEntities,
      modelEntities,
      selectedFolderPath,
      selectedRelPath,
      setActiveWorkTab,
      setExpanded,
      setFolderEntities,
      setModelEntities,
      setSelectedFolderPath,
      setSelectedRelPath,
      setSelectedRelPaths,
      showSaveNotification,
    ],
  );

  const baseActionKey = useCallback((action: PendingBaseAction) => {
    if (action.kind === "renameFolder") {
      return `${action.kind}:${action.fromFolder}->${action.toFolder}:${action.reason}`;
    }
    if (action.kind === "deleteFolderTree") {
      return `${action.kind}:${action.folderPath}:${action.reason}`;
    }
    return `${action.kind}:${JSON.stringify(createPropertyRefactorPayload(action.payload) || {})}:${action.targets.join(",")}`;
  }, []);

  const executePendingBaseActions = useCallback(async (actions: PendingBaseAction[], options?: { notify?: boolean }) => {
    if (actions.length === 0) return { applied: 0, failed: 0, updatedModelRelPaths: [] as string[], updatedBaseRelPaths: [] as string[] };
    const notify = options?.notify !== false;
    const failed: PendingBaseAction[] = [];
    const updatedModelRelPaths = new Set<string>();
    const updatedBaseRelPaths = new Set<string>();
    let applied = 0;

    for (const action of actions) {
      try {
        if (action.kind === "renameFolder") {
          modelEntities
            .filter((entity) => entity.relPath.startsWith(action.fromFolder))
            .forEach((entity) => updatedModelRelPaths.add(entity.relPath));
          await renameModelFolder(action.fromFolder, action.toFolder);
        } else if (action.kind === "deleteFolderTree") {
          const normalized = normalizeFolderPath(action.folderPath.replace(/^Model\/?/i, ""));
          modelEntities
            .filter((entity) => {
              const rel = normalizeFolderPath(entity.relPath.replace(/^Model\//, "").replace(/\/[^/]+\.json$/i, ""));
              return rel === normalized || rel.startsWith(`${normalized}/`);
            })
            .forEach((entity) => updatedModelRelPaths.add(entity.relPath));
          await deleteFolderTree(action.folderPath, {
            confirm: false,
            allowZoneRoot: true,
            notifySuccess: false,
            notifyFailure: false,
          });
        } else {
          const result = await runPropertyRefactor(action.payload, action.targets);
          result.updatedModelRelPaths.forEach((relPath) => updatedModelRelPaths.add(relPath));
          result.updatedBaseRelPaths.forEach((relPath) => updatedBaseRelPaths.add(relPath));
        }
        applied += 1;
      } catch (err) {
        console.error("[DataM8] Apply action failed:", err);
        failed.push(action);
        if (notify) {
          showSaveNotification("failed");
        }
      }
    }

    if (failed.length > 0 && notify) {
      showSaveNotification("failed");
    }

    if (applied > 0 && notify) {
      showSaveNotification("bulk-saved");
    }

    return {
      applied,
      failed: failed.length,
      updatedModelRelPaths: Array.from(updatedModelRelPaths),
      updatedBaseRelPaths: Array.from(updatedBaseRelPaths),
    };
  }, [
    deleteFolderTree,
    modelEntities,
    renameModelFolder,
    runPropertyRefactor,
    showSaveNotification,
  ]);

  const handleSaveBase = useCallback(
    async (updated: BaseEntity): Promise<BaseSaveResult> => {
      const previous = baseEntities.find((b) => b.relPath === updated.relPath);
      try {
        let hadMutation = false;
        let notificationStatus: BaseSaveResult["notificationStatus"] = "saved";
        const detectedUpdated = detectBaseType(updated.content, updated.relPath);
        const detectedPrevious = detectBaseType(previous?.content || {}, previous?.relPath || updated.relPath);
        const baseType = detectedUpdated.type !== "unknown" ? detectedUpdated.type : detectedPrevious.type;
        const nextItems = Array.isArray(detectedUpdated.items) ? detectedUpdated.items : [];
        const prevItems = Array.isArray(detectedPrevious.items) ? detectedPrevious.items : [];

        if (baseType && baseType !== "unknown") {
          assertNoDuplicateBaseKeys(baseType, nextItems);
          hadMutation = await persistBaseListItems(baseType, prevItems, nextItems, { save: false });
        } else {
          const updatedLocator = updated.locator || modelLocatorFromRelPath(updated.relPath);
          try {
            await patchEntity(updatedLocator, updated.content as Record<string, unknown>, { save: false });
            hadMutation = true;
          } catch {
            await createEntity(updatedLocator, updated.content as Record<string, unknown>, { save: false });
            hadMutation = true;
          }
        }
        setBaseEntities((list) => list.map((b) => (b.relPath === updated.relPath ? updated : b)));
        setBaseTabs((tabs) =>
          tabs.map((t) =>
            t.relPath === updated.relPath
              ? { ...t, dirty: false, title: formatBaseTitle(updated.name || updated.relPath.split("/").pop() || updated.relPath) }
              : t,
          ),
        );
        setTabDirty(updated.relPath, "base", false);
        const detected = detectBaseType(updated.content, updated.relPath).type;
        const pendingPatched = patchedBasePayloadRef.current.get(updated.relPath);
        const refactorPreviousContent =
          pendingPatched && deepEqual(pendingPatched.next.content || {}, updated.content || {})
            ? (pendingPatched.previousContent || previous?.content || {})
            : (previous?.content || {});

        if (previous?.content || pendingPatched?.previousContent) {
          const hasFolderSource = (folderRelPath: string) => {
            const normalizedFolder = normalizeFolderPath(folderRelPath.replace(/^Model\//, ""));
            if (!normalizedFolder) return false;
            const hasEntities = modelEntities.some((entity) => {
              const entityFolder = normalizeFolderPath(entity.relPath.replace(/^Model\//, "").replace(/\/[^/]+\.json$/i, ""));
              return entityFolder === normalizedFolder || entityFolder.startsWith(`${normalizedFolder}/`);
            });
            if (hasEntities) return true;
            return folderEntities.some((entry) => {
              const folderPath = normalizeFolderPath(entry.folderPath || "");
              return folderPath === normalizedFolder || folderPath.startsWith(`${normalizedFolder}/`);
            });
          };

          const nextActions: PendingBaseAction[] = [];
          const pushScopedRefactorAction = (
            payload: Partial<PropertyRefactorPayload>,
            propertyName: string,
            options?: { includePropertyValuesTarget?: boolean },
            scopeTargetsByName: Map<string, PropertyRefactorScopeTarget[]> = propertyScopeTargetsByName,
          ) => {
            const targets = uniqueScopeTargets([
              ...(scopeTargetsByName.get(propertyName) || []),
              ...(options?.includePropertyValuesTarget ? (["propertyValues"] as PropertyRefactorScopeTarget[]) : []),
            ]);
            if (targets.length === 0) return;
            nextActions.push({
              kind: "propertyRefactor",
              payload,
              targets,
              sourceRelPath: updated.relPath,
            });
          };
          if (detected === "zones") {
            const zoneRenames = collectZoneFolderRenames(refactorPreviousContent, updated.content);
            for (const rename of zoneRenames) {
              if (!hasFolderSource(rename.fromFolder)) continue;
              nextActions.push({
                kind: "renameFolder",
                fromFolder: rename.fromFolder,
                toFolder: rename.toFolder,
                sourceRelPath: updated.relPath,
                reason: "zones",
              });
            }
            const zoneDeletes = collectZoneFolderDeletes(refactorPreviousContent, updated.content);
            for (const folderPath of zoneDeletes) {
              if (!hasFolderSource(folderPath)) continue;
              nextActions.push({
                kind: "deleteFolderTree",
                folderPath,
                sourceRelPath: updated.relPath,
                reason: "zones",
              });
            }
          }
          if (detected === "properties") {
            const previousPropertyScopeTargetsByName = buildPropertyScopeTargetIndex(refactorPreviousContent);
            const propDiff = diffPropertyChanges(refactorPreviousContent, updated.content);
            propDiff.propertyRenames.forEach((rename) => {
              pushScopedRefactorAction({ propertyRenames: [rename] }, rename.oldName, {
                includePropertyValuesTarget: true,
              }, previousPropertyScopeTargetsByName);
            });
            propDiff.deletedProperties.forEach((name) => {
              pushScopedRefactorAction({ deletedProperties: [name] }, name, {
                includePropertyValuesTarget: true,
              }, previousPropertyScopeTargetsByName);
            });
          }
          if (detected === "propertyValues") {
            const valueDiff = diffPropertyValueChanges(refactorPreviousContent, updated.content);
            valueDiff.valueRenames.forEach((rename) => {
              pushScopedRefactorAction({ valueRenames: [rename] }, rename.property);
            });
            valueDiff.deletedValues.forEach((deletedValue) => {
              pushScopedRefactorAction({ deletedValues: [deletedValue] }, deletedValue.property);
            });
            valueDiff.valueMoves.forEach((move) => {
              pushScopedRefactorAction({ valueMoves: [move] }, move.oldProperty);
            });
          }
          if (nextActions.length > 0) {
            const uniqueActions: PendingBaseAction[] = [];
            const seen = new Set<string>();
            nextActions.forEach((action) => {
              const key = baseActionKey(action);
              if (seen.has(key)) return;
              seen.add(key);
              uniqueActions.push(action);
            });
            const refactorActions = uniqueActions.filter((action) => action.kind === "propertyRefactor");
            const structuralActions = uniqueActions.filter((action) => action.kind !== "propertyRefactor");
            const bulkUpdatedBaseRelPaths = new Set<string>();
            const bulkUpdatedModelRelPaths = new Set<string>();

            if (refactorActions.length > 0) {
              for (const action of refactorActions) {
                const result = await runPropertyRefactor(action.payload, action.targets);
                result.updatedBaseRelPaths.forEach((relPath) => bulkUpdatedBaseRelPaths.add(relPath));
                result.updatedModelRelPaths.forEach((relPath) => bulkUpdatedModelRelPaths.add(relPath));
              }
              notificationStatus = "bulk-saved";
            }

            if (structuralActions.length > 0) {
              const actionResult = await executePendingBaseActions(structuralActions, { notify: false });
              if (actionResult.failed > 0) {
                throw new Error(`${actionResult.failed} follow-up action(s) failed.`);
              }
              actionResult.updatedBaseRelPaths.forEach((relPath) => bulkUpdatedBaseRelPaths.add(relPath));
              actionResult.updatedModelRelPaths.forEach((relPath) => bulkUpdatedModelRelPaths.add(relPath));
              if (actionResult.applied > 0) {
                notificationStatus = "bulk-saved";
              }
            }

            if (notificationStatus === "bulk-saved") {
              clearDraftsForBulkSave({
                baseRelPaths: Array.from(bulkUpdatedBaseRelPaths),
                entityRelPaths: Array.from(bulkUpdatedModelRelPaths),
                sourceBaseRelPath: updated.relPath,
              });
            }
          }
        }
        patchedBasePayloadRef.current.delete(updated.relPath);
        clearPatchedBaseTimer(updated.relPath);
        if (hadMutation) {
          await saveModel();
        }
        return { notificationStatus };
      } catch (err) {
        setTabDirty(updated.relPath, "base", true);
        throw err;
      }
    },
    [
      baseEntities,
      baseActionKey,
      folderEntities,
      formatBaseTitle,
      modelEntities,
      propertyScopeTargetsByName,
      runPropertyRefactor,
      executePendingBaseActions,
      clearPatchedBaseTimer,
      clearDraftsForBulkSave,
      setBaseEntities,
      setBaseTabs,
      setTabDirty,
    ],
  );

  const moveEntityToFolder = useCallback(
    async (fromRelPath: string, folderPath: string) => {
      if (!fromRelPath) return;
      const existing = modelEntities.find((m) => m.relPath === fromRelPath);
      if (!existing) return;
      const fileName = fromRelPath.split("/").pop() || "";
      const targetParts = ["Model", ...folderPath.split("/").filter(Boolean), fileName];
      const toRelPath = targetParts.join("/");
      if (toRelPath === fromRelPath) return;
      try {
        await moveEntities(modelLocatorFromRelPath(fromRelPath), modelLocatorFromRelPath(toRelPath));
        setModelEntities((prev) =>
          prev.map((m) => (m.relPath === fromRelPath ? { ...m, relPath: toRelPath } : m)),
        );
        setModelTabs((prev) =>
          prev.map((t) => (t.relPath === fromRelPath ? { ...t, relPath: toRelPath } : t)),
        );
        if (selectedRelPath === fromRelPath) {
          setSelectedRelPath(toRelPath);
        }
        setSelectedRelPaths((prev) => {
          const next = new Set(prev);
          if (next.has(fromRelPath)) {
            next.delete(fromRelPath);
            next.add(toRelPath);
          }
          return next;
        });
        if (activeWorkTab === `entity:${fromRelPath}`) {
          setActiveWorkTab(`entity:${toRelPath}`);
        }
        setTreeFilter("");
        showSaveNotification("saved");
      } catch (err) {
        console.error("[DataM8] Move failed:", err);
        showSaveNotification("failed");
      }
    },
    [
      activeWorkTab,
      modelEntities,
      selectedRelPath,
      setActiveWorkTab,
      setModelEntities,
      setModelTabs,
      setSelectedRelPath,
      setSelectedRelPaths,
      setTreeFilter,
      showSaveNotification,
    ],
  );

  const confirmMoveEntities = useCallback(
    async (folderPath: string) => {
      const normalized = normalizeFolderPath(folderPath);
      if (!normalized) return;
      await moveTargets.reduce(
        (prev, fromRelPath) => prev.then(() => moveEntityToFolder(fromRelPath, normalized)),
        Promise.resolve(),
      );
      ensureExpandedPath(normalized);
      setMoveDialogOpen(false);
      setMoveTargets([]);
    },
    [ensureExpandedPath, moveEntityToFolder, moveTargets],
  );

  const hasAnyDirty = useMemo(() => anyDirty || dirtyFolderPaths.size > 0, [anyDirty, dirtyFolderPaths]);

  const persistActiveEditorBeforeSwitch = useCallback(async (): Promise<boolean> => {
    const active = activeWorkTab;
    if (!active) return true;
    if (active.startsWith("entity:")) {
      return (await entityPersistRef.current?.()) ?? true;
    }
    if (active.startsWith("base:")) {
      return (await basePersistRef.current?.()) ?? true;
    }
    if (active.startsWith("folder:")) {
      return (await folderPersistRef.current?.()) ?? true;
    }
    return true;
  }, [activeWorkTab]);

  const handleReload = useCallback(async () => {
    if (!solution) return;
    if (hasAnyDirty) {
      const proceed = await confirm({
        title: "Reload solution?",
        description: "You still have changes that are syncing. Reload anyway?",
        confirmText: "Reload",
        cancelText: "Cancel",
      });
      if (!proceed) return;
    }
    try {
      const reloadResponse = await fetch(`${apiBase}/model/reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!reloadResponse.ok) {
        const payload = await reloadResponse.json().catch(() => ({}));
        const serverMessage =
          typeof (payload as any)?.message === "string" && (payload as any).message.trim()
            ? (payload as any).message
            : typeof (payload as any)?.detail === "string" && (payload as any).detail.trim()
              ? (payload as any).detail
              : null;
        throw new Error(serverMessage ?? "Failed to reload the model. The backend may have encountered an issue — try again or restart the app.");
      }
    } catch (err) {
      showAppError("Reload failed", (err as Error).message);
      return;
    }

    // Rescan plugins on the backend, then refresh the frontend catalog.
    // Must be sequential: the GET /plugins/ fetch must not start until
    // POST /plugins/reload has finished updating the backend registry.
    try {
      const pluginReloadResponse = await fetch(`${apiBase}/plugins/reload`, { method: "POST" });
      if (!pluginReloadResponse.ok) {
        const payload = await pluginReloadResponse.json().catch(() => ({}));
        const message = payload.message && typeof payload.message === "string" ? payload.message : null;
        const detail = payload.detail && typeof payload.details === "string" ? payload.detail : null;
        throw new Error(message ?? detail ?? `Plugin reload failed (${pluginReloadResponse.status}).`);
      }
    } catch (err) {
      showAppError("Plugin reload failed", (err as Error).message);
      return;
    }
    void refreshConnectorCatalog();

    const fallbackSource: SolutionSource | null = solutionSource
      ? solutionSource
      : electronLike && solutionPath
        ? { kind: "electron-path", path: solutionPath }
        : { kind: "server-path", path: solutionPath || "" };
    const result = fallbackSource ? await loadSolution(fallbackSource) : undefined;
    if (result) {
      applyLoadedSolution(result);
    }
  }, [applyLoadedSolution, confirm, electronLike, hasAnyDirty, loadSolution, showAppError, solution, solutionPath, solutionSource]);

  const activeTabId =
    activeWorkTab?.startsWith("base:")
      ? "base"
      : activeWorkTab?.startsWith("entity:")
        ? "entity"
        : activeTab;
  const current = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const propertyOptions = useMemo(() => {
    return buildPropertyOptionsFromBaseEntities(baseEntities);
  }, [baseEntities]);

  const attributeTypeOptions = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "attributeTypes");
    return (entry?.content?.attributeTypes || []).map((a: BaseAttributeType) => ({
      value: a.name,
      label: a.displayName || a.name,
    }));
  }, [baseEntities]);

  const baseSidebarItems = useMemo(() => {
    const list: (BaseEntity & { displayName?: string })[] = [];
    baseEntities.forEach((b) => {
      list.push({ ...b, displayName: formatBaseTitle(b.name) });
    });
    return list;
  }, [baseEntities, formatBaseTitle]);

  const folderEntityByPath = useMemo(() => indexFolderEntities(folderEntities), [folderEntities]);

  const modelFolderPaths = useMemo(() => {
    const paths = new Set<string>();
    const addWithAncestors = (rawPath: string) => {
      const normalized = normalizeFolderPath(rawPath);
      if (!normalized) return;
      const parts = normalized.split("/").filter(Boolean);
      for (let i = 1; i <= parts.length; i += 1) {
        paths.add(parts.slice(0, i).join("/"));
      }
    };
    modelEntities.forEach((entity) => {
      const normalized = entity.relPath.split(/[\\/]/).join("/");
      const parts = normalized.split("/").filter(Boolean);
      const rel = normalizeFolderPath((parts[0] === "Model" ? parts.slice(1) : parts).slice(0, -1).join("/"));
      addWithAncestors(rel);
    });
    folderEntities.forEach((entry) => {
      const rel = normalizeFolderPath(entry.folderPath || "");
      addWithAncestors(rel);
    });
    zoneFolderPaths.forEach((zonePath: string) => addWithAncestors(zonePath));
    return Array.from(paths).sort((a, b) => a.localeCompare(b));
  }, [folderEntities, modelEntities, zoneFolderPaths]);

  const folderHierarchyItems = useMemo(
    () =>
      modelFolderPaths.map((path) => {
        const meta = getFolderMeta(folderEntityByPath.get(path));
        const displayName =
          typeof meta?.name === "string" && meta.name.trim()
            ? meta.name.trim()
            : path.split("/").pop() || path;
        return {
          value: path,
          label: displayName,
        };
      }),
    [folderEntityByPath, modelFolderPaths],
  );

  const selectableFolderPaths = useMemo(() => {
    const set = new Set<string>();
    modelFolderPaths.forEach((path) => {
      if (path.split("/").filter(Boolean).length > 1) {
        set.add(path);
      }
    });
    return set;
  }, [modelFolderPaths]);

  const selectedFolderEntity = useMemo(() => {
    const key = normalizeFolderPath(selectedFolderPath || "");
    if (!key) return null;
    return folderEntityByPath.get(key) || null;
  }, [folderEntityByPath, selectedFolderPath]);

  const selectedEntityFolderContext = useMemo(() => {
    if (!selectedEntity) return null;
    return resolveFolderInheritance({
      entityRelPath: selectedEntity.relPath,
      folderEntities,
    });
  }, [folderEntities, selectedEntity]);

  const selectedFolderInheritanceContext = useMemo(() => {
    const folderPath = normalizeFolderPath(selectedFolderPath || "");
    if (!folderPath) return null;
    return resolveFolderInheritance({
      folderPath,
      folderEntities,
      includeCurrentFolder: false,
    });
  }, [folderEntities, selectedFolderPath]);

  const saveFolderMetadata = useCallback(
    async (payload: { relPath: string; content: FolderEntity["content"]; folderPath: string; name: string }) => {
      const currentFolderPath = normalizeFolderPath(payload.folderPath);
      const currentParts = currentFolderPath.split("/").filter(Boolean);
      const parentFolderPath = currentParts.slice(0, -1).join("/");
      const currentFolderName = currentParts[currentParts.length - 1] || "";
      const requestedName = (payload.name || "").replace(/[\\/]/g, "").trim();
      const targetFolderName = requestedName || currentFolderName;
      const targetFolderPath = normalizeFolderPath(
        parentFolderPath ? `${parentFolderPath}/${targetFolderName}` : targetFolderName,
      );
      const renameRequested = !!(currentFolderPath && targetFolderPath && currentFolderPath !== targetFolderPath);

      if (renameRequested) {
        if (folderEntityByPath.has(targetFolderPath)) {
          throw new Error("A folder with this name already exists on this level.");
        }
      }

      const effectiveFolderPath = currentFolderPath;
      const effectiveRelPath = `Model/${effectiveFolderPath}/.properties.json`;
      const effectiveLocator = folderLocatorFromFolderPath(effectiveFolderPath);
      const folderExists = folderEntityByPath.has(effectiveFolderPath);
      const nextContent = {
        ...(payload.content || {}),
        path: effectiveFolderPath,
        name: targetFolderName,
      };

      if (folderExists) {
        await patchEntity(effectiveLocator, nextContent as Record<string, unknown>);
      } else {
        await createEntity(effectiveLocator, nextContent as Record<string, unknown>);
      }

      setFolderEntities((prev) => {
        const normalizedPath = normalizeFolderPath(effectiveFolderPath);
        const nextEntity: FolderEntity = {
          locator: folderLocatorFromFolderPath(normalizedPath),
          name: targetFolderName,
          relPath: effectiveRelPath,
          folderPath: normalizedPath,
          content: nextContent,
        };
        const idx = prev.findIndex((entry) => normalizeFolderPath(entry.folderPath) === normalizedPath);
        if (idx < 0) return [...prev, nextEntity];
        const clone = [...prev];
        clone[idx] = nextEntity;
        return clone;
      });
      setSelectedFolderPath(normalizeFolderPath(effectiveFolderPath));
      setActiveWorkTab(`folder:${normalizeFolderPath(effectiveFolderPath)}`);

      if (renameRequested) {
        const actionResult = await executePendingBaseActions([
          {
            kind: "renameFolder",
            fromFolder: `Model/${currentFolderPath}`,
            toFolder: `Model/${targetFolderPath}`,
            sourceRelPath: effectiveRelPath,
            reason: "folderProperties",
          },
        ]);
        clearDraftsForBulkSave({
          entityRelPaths: actionResult.updatedModelRelPaths,
          baseRelPaths: actionResult.updatedBaseRelPaths,
        });
      }
    },
    [clearDraftsForBulkSave, executePendingBaseActions, folderEntityByPath, setActiveWorkTab, setFolderEntities, setSelectedFolderPath],
  );

  const setFolderDirty = useCallback((folderPath: string, dirty: boolean) => {
    const normalized = normalizeFolderPath(folderPath);
    if (!normalized) return;
    setDirtyFolderPaths((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(normalized);
      else next.delete(normalized);
      return next;
    });
  }, []);

  const createFolder = useCallback((parentFolderPath: string) => {
    const parent = normalizeFolderPath(parentFolderPath);
    if (!parent) return;
    setNewFolderParentPath(parent);
    setNewFolderName("");
    setNewFolderDialogOpen(true);
  }, []);

  const submitCreateFolder = useCallback(async () => {
    const parent = normalizeFolderPath(newFolderParentPath);
    const folderName = (newFolderName || "").replace(/[\\/]/g, "").trim();
    if (!parent) return;
    if (!folderName) {
      showAppError("Folder creation failed", "Folder name is required.");
      return;
    }

    const newFolderPath = normalizeFolderPath(`${parent}/${folderName}`);
    if (folderEntityByPath.has(newFolderPath)) {
      showAppError("Folder creation failed", "A folder with this path already exists.");
      return;
    }

    const content = {
      id: Date.now(),
      name: folderName,
      path: newFolderPath,
      properties: [],
    };

    try {
      await saveFolderMetadata({
        relPath: `Model/${newFolderPath}/.properties.json`,
        content,
        folderPath: newFolderPath,
        name: folderName,
      });
      ensureExpandedPath(parent);
      ensureExpandedPath(newFolderPath);
      setSelectedFolderPath(newFolderPath);
      setActiveWorkTab(`folder:${newFolderPath}`);
      setNewFolderDialogOpen(false);
      setNewFolderName("");
      showSaveNotification("saved");
    } catch (err) {
      console.error("[DataM8] Folder creation failed:", err);
      showSaveNotification("failed");
    }
  }, [ensureExpandedPath, folderEntityByPath, newFolderName, newFolderParentPath, saveFolderMetadata, setActiveWorkTab, setSelectedFolderPath, showAppError, showSaveNotification]);

  const deleteFolder = useCallback(
    async (folderPath: string) => {
      try {
        await deleteFolderTree(folderPath, {
          confirm: true,
          allowZoneRoot: false,
          notifySuccess: true,
          notifyFailure: true,
        });
      } catch { }
    },
    [deleteFolderTree],
  );

  const handleDuplicate = useCallback(
    (relPath?: string) => {
      if (!solutionPath) return;
      let targets: string[] = [];
      if (relPath) {
        if (selectedRelPaths.has(relPath)) {
          targets = Array.from(selectedRelPaths);
        } else {
          targets = [relPath];
        }
      } else {
        targets = Array.from(selectedRelPaths);
      }
      if (targets.length > 0) {
        duplicateModelEntities(targets, solutionPath);
      }
    },
    [duplicateModelEntities, selectedRelPaths, solutionPath],
  );

  const handleDelete = useCallback(
    (relPath?: string) => {
      if (!solutionPath) return;
      let targets: string[] = [];
      if (relPath) {
        if (selectedRelPaths.has(relPath)) {
          targets = Array.from(selectedRelPaths);
        } else {
          targets = [relPath];
        }
      } else {
        targets = Array.from(selectedRelPaths);
      }
      if (targets.length > 0) {
        deleteModelEntities(targets, solutionPath);
      }
    },
    [deleteModelEntities, selectedRelPaths, solutionPath],
  );

  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  useEffect(() => {
    if (!window.desktop?.isElectron || !window.desktop?.theme?.setCurrent) return;
    void window.desktop.theme.setCurrent(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isWindowsElectron) return;
    const desktopWindow = window.desktop?.window;
    void Promise.resolve(desktopWindow?.getTitle?.()).then((title: string | null | undefined) => {
      if (typeof title === "string" && title.trim()) {
        setWindowTitle(title);
      }
    }).catch(() => { });
    const unsubscribe = desktopWindow?.onTitleChanged?.((title) => {
      setWindowTitle(title || "DataM8");
    });
    return () => {
      unsubscribe?.();
    };
  }, [isWindowsElectron]);

  useEffect(() => {
    if (!isWindowsElectron || !window.desktop?.menu?.getTopLevelLabels) return;
    void Promise.resolve(window.desktop.menu.getTopLevelLabels()).then((labels) => {
      setWindowMenuLabels(Array.isArray(labels) ? labels : []);
    }).catch(() => { });
  }, [isWindowsElectron]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        handleDuplicate();
      }
      if (
        e.key === "Delete" ||
        (e.key === "Backspace" && (e.metaKey || e.ctrlKey))
      ) {
        handleDelete();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDuplicate, handleDelete]);

  const dialogOpen = serverDialog && (pickerOpen || (!solution && !newProjectOpen));

  return (
    <div
      className={`app ${sidebarOpen ? "" : "app--sidebar-collapsed"} ${isWindowsElectron ? "app--windows-titlebar" : ""}`}
      style={{ "--sidebar-size": sidebarOpen ? `${sidebarSize}px` : "68px" } as CSSProperties}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".dm8s,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <SolutionDialog
        open={dialogOpen}
        onLoaded={(model, base, folders) => {
          applyLoadedSolution({ modelEntities: model, baseEntities: base, folderEntities: folders }, { resetWorkspace: true });
        }}
      />
      <MigrateSolutionV1Wizard
        open={migrationOpen}
        sourceSolutionPath={migrationSourcePath || ""}
        onLoaded={(model, base, folders) => {
          applyLoadedSolution({ modelEntities: model, baseEntities: base, folderEntities: folders }, { resetWorkspace: true });
        }}
      />
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={handleProjectCreated}
        defaultProjectRoot={projectRootHint}
      />
      <CreateModelEntityWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        folderHierarchyItems={folderHierarchyItems}
      />
      <MoveEntitiesDialog
        open={moveDialogOpen}
        onOpenChange={handleMoveDialogOpenChange}
        count={moveTargets.length}
        initialFolderPath={moveFolderPath}
        folderHierarchyItems={folderHierarchyItems}
        onConfirm={confirmMoveEntities}
      />
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="new-folder-dialog max-w-md">
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>{`Create a folder under ${newFolderParentPath}.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-folder-name">Folder name</Label>
            <Input
              id="new-folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder"
            />
          </div>
          <DialogFooter className="border-t border-border/70 pt-4">
            <Button type="button" variant="ghost" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={() => void submitCreateFolder()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isWindowsElectron ? (
        <WindowsTitleBar
          title={windowTitle}
          menuLabels={windowMenuLabels}
          onOpenMenu={(label, anchor) => {
            void window.desktop?.menu?.popupSubmenu?.(label, anchor.left, anchor.bottom);
          }}
        />
      ) : null}

      <div className="main-area">
        <aside className="nav-panel">
          <Sidebar
            tree={tree}
            onSelectEntity={(relPath, multi) => {
              void (async () => {
                if (!multi && activeWorkTab !== `entity:${relPath}`) {
                  const canSwitch = await persistActiveEditorBeforeSwitch();
                  if (!canSwitch) return;
                }
                toggleEntitySelection(relPath, multi);
                setSelectedFolderPath(null);
                if (!multi) {
                  const ent = modelEntities.find((m) => m.relPath === relPath);
                  openModelTab(relPath, ent?.name || relPath);
                }
              })();
            }}
            onSelectFolder={(folderPath) => {
              void (async () => {
                const normalized = normalizeFolderPath(folderPath);
                if (`folder:${normalized}` !== activeWorkTab) {
                  const canSwitch = await persistActiveEditorBeforeSwitch();
                  if (!canSwitch) return;
                }
                setSelectedFolderPath(normalized);
                setSelectedRelPath(null);
                setSelectedRelPaths(new Set());
                setSelectedBaseRelPath(null);
                setActiveWorkTab(normalized ? `folder:${normalized}` : null);
              })();
            }}
            onMoveEntity={moveEntityToFolder}
            onCreateFolder={createFolder}
            onDeleteFolder={deleteFolder}
            onRequestMove={openMoveDialog}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            ensureExpanded={ensureExpandedPath}
            selectedRelPath={selectedRelPath}
            selectedRelPaths={selectedRelPaths}
            selectedFolderPath={selectedFolderPath}
            selectableFolderPaths={selectableFolderPaths}
            expanded={expanded}
            onToggle={handleToggle}
            filter={treeFilter}
            onFilterChange={setTreeFilter}
            baseItems={baseSidebarItems}
            onSelectBase={(rel, title) => {
              void (async () => {
                if (activeWorkTab !== `base:${rel}`) {
                  const canSwitch = await persistActiveEditorBeforeSwitch();
                  if (!canSwitch) return;
                }
                openBaseTab(rel, title);
              })();
            }}
            selectedBaseRelPath={selectedBaseRelPath}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            onResizeStart={startResize}
            onNew={() => setNewProjectOpen(true)}
            onOpen={() => {
              void triggerSolutionSelect(false);
            }}
            onReload={() => {
              void handleReload();
            }}
            canReload={!!solution && !solutionLoading}
            onAddEntity={() => {
              if (!solution || solutionLoading) return;
              setWizardOpen(true);
            }}
            canAddEntity={!!solution && !solutionLoading}
            onToggleTheme={handleToggleTheme}
            resolvedTheme={resolvedTheme}
            saveNotification={saveNotification}
            modelTreeLoading={solutionLoading}
          />
        </aside>

        <section className="editor-col">
          <div className="workspace-header">
            <div className="workspace-header__tabs">
              <WorkTabs
                baseGroup={
                  baseTabs.length
                    ? {
                      label: "Base",
                      tabs: baseTabs,
                      accent: "var(--accent)",
                    }
                    : undefined
                }
                modelGroups={groupedModelTabs.map((group) => ({
                  id: group.zone,
                  label: group.zone,
                  accent: group.color,
                  tabs: group.tabs,
                }))}
                activeWorkTab={activeWorkTab}
                collapsedGroups={collapsedGroups}
                onToggleGroup={(id: string) => toggleGroup(id)}
                onFocusTab={(kind: "base" | "entity", relPath: string) => {
                  const target = `${kind}:${relPath}`;
                  if (target === activeWorkTab) return;
                  void (async () => {
                    const canSwitch = await persistActiveEditorBeforeSwitch();
                    if (!canSwitch) return;
                    if (kind === "base") {
                      focusBaseTab(relPath);
                    } else {
                      focusEntityTab(relPath);
                    }
                  })();
                }}
                onCloseTab={(kind: "base" | "entity", relPath: string) => closeTab(kind, relPath)}
                onConfirmCloseTab={async (_kind: "base" | "entity", _relPath: string, isDirty: boolean) => {
                  if (!isDirty) return true;
                  const result = await confirm({
                    title: "Pending Sync",
                    description: "This file still has unsaved changes due to a save error. Close it anyway?",
                  });
                  return result;
                }}
              />
            </div>
            <div className="workspace-header__actions">
              <button
                type="button"
                className="workspace-header__close-all"
                disabled={!baseTabs.length && !modelTabs.length}
                aria-label="Close all tabs"
                title="Close all tabs"
                onClick={async () => {
                  const dirtyTabs = [...modelTabs.filter((t) => t.dirty), ...baseTabs.filter((t) => t.dirty)];
                  if (dirtyTabs.length > 0) {
                    const result = await confirm({
                      title: "Pending Sync",
                      description: `You still have ${dirtyTabs.length} file(s) with unsaved changes due to save errors. Close all tabs anyway?`,
                    });
                    if (!result) return;
                  }
                  closeAllTabs();
                }}
              >
                {"\u00D7"}
              </button>
              <div className="workspace-header__actions-separator" aria-hidden="true" />
              <div className="workspace-header__run-actions" aria-label="Run actions">
                <button
                  type="button"
                  className="icon-btn workspace-header__run-toggle"
                  onClick={() => setGlobalRefreshOpen(true)}
                  aria-label="Refresh schemas"
                  title="Refresh schemas"
                >
                  <RefreshCw className="workspace-header__run-icon h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`icon-btn workspace-header__run-toggle ${activeRunPanel === "generator" ? "icon-btn--active" : ""}`}
                  onClick={() => {
                    setActiveRunPanel((prev) => (prev === "generator" ? null : "generator"));
                  }}
                  aria-label="Toggle generator"
                  title="Generator"
                >
                  <Bot className={`workspace-header__run-icon h-4 w-4 ${activeRunPanel === "generator" ? "workspace-header__run-icon--active" : ""}`} />
                </button>
              </div>
            </div>
          </div>
          <div className="editor-panel">
            {activeWorkTab?.startsWith("folder:") && selectedFolderPath ? (
              <FolderEditor
                selectedFolderPath={selectedFolderPath}
                folderEntity={selectedFolderEntity}
                propertyOptions={propertyOptions}
                productOptions={productOptions}
                moduleOptionsByProduct={moduleOptionsByProduct}
                inheritedFolderProps={selectedFolderInheritanceContext?.inheritedProps || []}
                onSave={saveFolderMetadata}
                registerPersist={(persist) => {
                  folderPersistRef.current = persist;
                }}
                onDirtyChange={setFolderDirty}
                onSaveNotification={showSaveNotification}
              />
            ) : (
              <Workspace
                activeTab={current as Tab}
                activeWorkTab={activeWorkTab}
                selectedEntity={selectedEntity}
                onSave={handleSave}
                baseEntities={baseEntities}
                selectedBase={selectedBase}
                onSelectBase={setSelectedBaseRelPath}
                onSaveBase={handleSaveBase}
                onDirtyEntity={(relPath, dirty) => setTabDirty(relPath, "entity", dirty)}
                onDirtyBase={(relPath, dirty) => setTabDirty(relPath, "base", dirty)}
                onPatchBaseEntity={onPatchBaseEntity}
                getEntityDraft={getEntityDraft}
                setEntityDraft={setEntityDraft}
                getBaseDraft={getBaseDraft}
                setBaseDraft={setBaseDraft}
                registerEntityPersist={(persist) => {
                  entityPersistRef.current = persist;
                }}
                registerBasePersist={(persist) => {
                  basePersistRef.current = persist;
                }}
                onSaveNotification={showSaveNotification}
                dataTypes={dataTypes}
                dataTypeDefinitions={dataTypeDefinitions}
                attributeTypeOptions={attributeTypeOptions}
                baseItemSelectionRequest={baseItemSelectionRequest}
                propertyOptions={propertyOptions}
                modelEntities={modelEntities}
                solutionPath={solutionPath}
                generatorTargets={generatorTargets}
                entityInheritedProps={{
                  folderProps: selectedEntityFolderContext?.inheritedProps || [],
                }}
                entityEffectiveDataProduct={selectedEntityFolderContext?.effectiveDataProduct || ""}
                entityEffectiveDataModule={selectedEntityFolderContext?.effectiveDataModule || ""}
                onJumpToEntity={(relPath) => {
                  if (!relPath || activeWorkTab === `entity:${relPath}`) return;
                  void (async () => {
                    const canSwitch = await persistActiveEditorBeforeSwitch();
                    if (!canSwitch) return;
                    const target = modelEntities.find((m) => m.relPath === relPath);
                    const title = target?.name || relPath.split("/").pop() || relPath;
                    openModelTab(relPath, title);
                    setSelectedRelPath(relPath);
                    setSelectedFolderPath(null);
                    focusEntityTab(relPath);
                  })();
                }}
                onJumpToDataSource={(name) => {
                  if (!name) return;
                  void (async () => {
                    const dsBase = baseEntities.find((b) =>
                      (b.content?.dataSources || []).some((d) => d?.name === name),
                    );
                    if (!dsBase) {
                      showAppError("Data source not found", `Could not locate data source "${name}" in the loaded base files.`);
                      return;
                    }
                    if (activeWorkTab !== `base:${dsBase.relPath}`) {
                      const canSwitch = await persistActiveEditorBeforeSwitch();
                      if (!canSwitch) return;
                    }
                    setBaseItemSelectionRequest({
                      relPath: dsBase.relPath,
                      itemName: name,
                      token: Date.now(),
                    });
                    openBaseTab(dsBase.relPath, "Data Sources");
                    setSelectedBaseRelPath(dsBase.relPath);
                    focusBaseTab(dsBase.relPath);
                  })();
                }}
              />
            )}
          </div>

          <div className={`run-panel-shell ${activeRunPanel === "generator" ? "run-panel-shell--active" : ""}`}>
            <div className="generator-panel">
              <GeneratorPanel
                targets={generatorTargets}
                selectedTarget={generatorTarget || generatorTargets[0] || ""}
                onSelectTarget={setGeneratorTarget}
                selectedLogLevel={generatorLogLevel}
                onSelectLogLevel={setGeneratorLogLevel}
                onRun={runGenerator}
                onValidate={runValidation}
                onClose={() => setActiveRunPanel(null)}
                running={generatorRunning}
                log={generatorLog}
                stderr={generatorStderr}
                error={generatorError}
              />
            </div>
          </div>

          {globalRefreshOpen ? (
            <RefreshSchemasDialog
              scope={{ kind: "all" }}
              isOpen={globalRefreshOpen}
              onClose={() => setGlobalRefreshOpen(false)}
            />
          ) : null}
          <div className="error-surface-slot">
            <InfoSurfaceHost scope="app" />
          </div>
          <div className="error-surface-slot">
            <ErrorSurfaceHost scope="app" />
          </div>
        </section>
      </div>
    </div>
  );
}
