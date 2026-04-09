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
import { Bot, ShieldCheck } from "lucide-react";
import type { PropertyRefactorPayload } from "@datam8/types";
import { Sidebar } from "../features/model/components/Sidebar";
import { Workspace } from "../features/model/components/Workspace";
import { FolderEditor } from "../features/model/components/workspace/folder-editor/FolderEditor";
import { GeneratorPanel } from "../features/generator/GeneratorPanel";
import { ValidatorPanel } from "../features/validator/ValidatorPanel";
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
import { applyPropertyRefactorToModelEntities, summarizePropertyRefactorImpact } from "../features/model/refactor/applyPropertyRefactor";
import { createPropertyRefactorPayload, diffPropertyChanges, diffPropertyValueChanges } from "../features/model/refactor/propertyRefactor";
import type { BaseAttributeType, BaseDataProduct, BaseDataTypeDefinition, BaseEntity, BaseZone, FolderEntity, ModelEntity, Tab } from "../features/model/model-types";
import { buildPropertyOptionsFromBaseEntities } from "../features/model/property-options";
import { apiBase } from "../config";
import { deepEqual } from "../shared/utils/deepEqual";
import { humanize, toLower } from "../shared/utils/strings";
import { config, isBrowserLike, isElectronMode, shouldUseServerDialog, syncConfigFromServer, type RuntimeAppMode } from "../config";
import { buildValidateUrl, readValidateErrorMessage, readValidateMessages, type ValidateResponse } from "../features/validator/validatorApi";
import { createEntity, deleteEntity, moveEntities, patchEntity, saveModel } from "../shared/api/v2Client";
import { ErrorSurfaceHost, useErrorSurface } from "../shared/ui/ErrorSurface";

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
      sourceRelPath: string;
      preview?: string;
    };
type BaseActionPrompt = {
  sourceRelPath: string;
  actions: PendingBaseAction[];
  rollbackBaseEntity: BaseEntity | null;
  rollbackFolderEntity?: FolderEntity | null;
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
  const [baseActionPrompt, setBaseActionPrompt] = useState<BaseActionPrompt | null>(null);
  const [applyingBaseActions, setApplyingBaseActions] = useState(false);
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
  const { duplicateModelEntities, deleteModelEntities } = useModelActions();
  const { resolvedTheme, setTheme } = useTheme();
  const isWindowsElectron = window.desktop?.isElectron && window.desktop?.platform === "win32";
  const {
    generatorTarget,
    generatorTargets,
    generatorLog,
    generatorStderr,
    generatorExit,
    generatorError,
    generatorRunning,
    generatorLogLevel,
    setGeneratorTarget,
    setGeneratorLogLevel,
    runGenerator,
  } = useGenerator();
  const [activeRunPanel, setActiveRunPanel] = useState<"generator" | "validator" | null>(null);
  const [windowTitle, setWindowTitle] = useState("DataM8");
  const [windowMenuLabels, setWindowMenuLabels] = useState<string[]>([]);
  const [validatorRunning, setValidatorRunning] = useState(false);
  const [validatorMessages, setValidatorMessages] = useState<string[]>([]);
  const [validatorResolvedPath, setValidatorResolvedPath] = useState<string | null>(null);
  const [validatorError, setValidatorError] = useState<string | null>(null);
  const validatorRunInFlightRef = useRef(false);
  const { showError } = useErrorSurface();
  const confirm = useConfirm();
  const { width: sidebarSize, setWidth: setSidebarSize, startResize } = useResizablePane({
    initialWidth: sidebarWidth,
    onChange: setSidebarWidth,
  });

  useEffect(() => {
    setSidebarSize(sidebarWidth);
  }, [setSidebarSize, sidebarWidth]);

  const showAppError = useCallback(
    (title: string, description?: string, onRetry?: (() => void) | null) => {
      showError("app", { title, description, onRetry: onRetry || null, retryLabel: "Retry" });
    },
    [showError],
  );

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
      setBaseActionPrompt(null);
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
          const previousByKey = new Map<string, Record<string, unknown>>();
          for (const item of prevItems) {
            const locator = buildBaseEntityLocator(baseType, item as Record<string, unknown>);
            if (!locator) continue;
            previousByKey.set(locator, item as Record<string, unknown>);
          }

          for (const item of nextItems) {
            const locator = buildBaseEntityLocator(baseType, item as Record<string, unknown>);
            if (!locator) continue;
            const prevItem = previousByKey.get(locator);
            if (prevItem) {
              if (!deepEqual(prevItem, item)) {
                await patchEntity(locator, item as Record<string, unknown>, { save: false });
                hadMutation = true;
              }
              previousByKey.delete(locator);
            } else {
              await createEntity(locator, item as Record<string, unknown>, { save: false });
              hadMutation = true;
            }
          }

          for (const [locator] of previousByKey) {
            await deleteEntity(locator, { save: false });
            hadMutation = true;
          }
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
      } catch (err) {
        setTabDirty(relPath, "base", true);
        setBaseTabs((tabs) =>
          tabs.map((t) => (t.relPath === relPath ? { ...t, dirty: true } : t)),
        );
        showAppError("Save failed", (err as Error).message);
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
    [clearPatchedBaseTimer, formatBaseTitle, setBaseTabs, setTabDirty, showAppError],
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
      const pendingEntry: BaseEntity = { ...baseEntry, content: nextContent };

      setBaseEntities((prev) =>
        prev.map((b) => (b.relPath === relPath ? pendingEntry : b)),
      );

      const title = formatBaseTitle(baseEntry?.name || relPath.split("/").pop() || relPath);
      setBaseTabs((tabs) => (tabs.some((t) => t.relPath === relPath) ? tabs : [...tabs, { relPath, title, dirty: false }]));
      schedulePatchedBaseAutosave(pendingEntry, baseEntry.content);
    },
    [baseEntities, formatBaseTitle, schedulePatchedBaseAutosave, setBaseEntities, setBaseTabs],
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
  const propertyValuesEntry = useMemo(
    () => baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "propertyValues"),
    [baseEntities],
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
    async (changes: Partial<PropertyRefactorPayload>) => {
      const payload = createPropertyRefactorPayload(changes);
      if (!payload) return;
      const result = applyPropertyRefactorToModelEntities(modelEntities, payload);
      if (result.updatedEntities.length === 0) return;
      const currentByRelPath = new Map(modelEntities.map((entity) => [entity.relPath, entity]));
      for (const entity of result.updatedEntities) {
        const previous = currentByRelPath.get(entity.relPath);
        const patch = buildTopLevelEntityPatch(
          (previous?.content || {}) as Record<string, unknown>,
          (entity.content || {}) as Record<string, unknown>,
        );
        if (Object.keys(patch).length === 0) continue;
        await patchEntity(modelLocatorFromRelPath(entity.relPath), patch);
      }
      const updatedByRelPath = new Map(result.updatedEntities.map((entity) => [entity.relPath, entity]));
      setModelEntities((prev) => prev.map((entity) => updatedByRelPath.get(entity.relPath) || entity));
      void summarizePropertyRefactorImpact(result);
    },
    [modelEntities, setModelEntities],
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
        showAppError("Delete folder not allowed", "Zone root folders cannot be deleted from the model tree.");
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

        return true;
      } catch (err) {
        if (options?.notifyFailure !== false) {
          showAppError("Delete folder failed", (err as Error).message || "Unknown error");
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
      showAppError,
    ],
  );

  const baseActionKey = useCallback((action: PendingBaseAction) => {
    if (action.kind === "renameFolder") {
      return `${action.kind}:${action.fromFolder}->${action.toFolder}:${action.reason}`;
    }
    if (action.kind === "deleteFolderTree") {
      return `${action.kind}:${action.folderPath}:${action.reason}`;
    }
    return `${action.kind}:${JSON.stringify(createPropertyRefactorPayload(action.payload) || {})}`;
  }, []);

  const applyPendingBaseActions = useCallback(async () => {
    const prompt = baseActionPrompt;
    if (applyingBaseActions || !prompt || prompt.actions.length === 0) return;
    setApplyingBaseActions(true);
    const failed: PendingBaseAction[] = [];
    let applied = 0;
    try {
      for (const action of prompt.actions) {
        try {
          if (action.kind === "renameFolder") {
            await renameModelFolder(action.fromFolder, action.toFolder);
          } else if (action.kind === "deleteFolderTree") {
            await deleteFolderTree(action.folderPath, {
              confirm: false,
              allowZoneRoot: true,
              notifySuccess: false,
              notifyFailure: false,
            });
          } else {
            await runPropertyRefactor(action.payload);
          }
          applied += 1;
        } catch (err) {
          failed.push(action);
          showAppError("Apply action failed", (err as Error).message);
        }
      }
    } finally {
      setApplyingBaseActions(false);
    }

    if (failed.length > 0) {
      showAppError("Some actions were not applied", `${failed.length} action(s) failed.`);
      setBaseActionPrompt({ ...prompt, actions: failed });
      return;
    }

    const hasStructuralActions = prompt.actions.some((action) => action.kind !== "propertyRefactor");
    if (applied > 0 && hasStructuralActions) {
      try {
        const fallbackSource: SolutionSource | null = solutionSource
          ? solutionSource
          : electronLike && solutionPath
            ? { kind: "electron-path", path: solutionPath }
            : { kind: "server-path", path: solutionPath || "" };
        const result = fallbackSource ? await loadSolution(fallbackSource) : undefined;
        if (result) {
          applyLoadedSolution(result);
        }
      } catch (err) {
        showAppError("Reload after actions failed", (err as Error).message || "Unknown error");
      }
    }
    setBaseActionPrompt(null);
  }, [
    applyLoadedSolution,
    applyingBaseActions,
    baseActionPrompt,
    deleteFolderTree,
    electronLike,
    loadSolution,
    renameModelFolder,
    runPropertyRefactor,
    solutionPath,
    solutionSource,
    showAppError,
  ]);

  const undoBaseActionPrompt = useCallback(async () => {
    const prompt = baseActionPrompt;
    if (applyingBaseActions || !prompt) return;

    if (!prompt.rollbackBaseEntity && !prompt.rollbackFolderEntity) {
      setBaseActionPrompt(null);
      return;
    }

    setApplyingBaseActions(true);
    try {
      if (prompt.rollbackBaseEntity) {
        const rollback = prompt.rollbackBaseEntity;
        const locator = rollback.locator || modelLocatorFromRelPath(rollback.relPath);
        try {
          await patchEntity(locator, rollback.content as Record<string, unknown>);
        } catch {
          await createEntity(locator, rollback.content as Record<string, unknown>);
        }

        setBaseEntities((list) => list.map((b) => (b.relPath === rollback.relPath ? rollback : b)));
        setBaseTabs((tabs) =>
          tabs.map((t) =>
            t.relPath === rollback.relPath
              ? { ...t, dirty: false, title: formatBaseTitle(rollback.name || rollback.relPath.split("/").pop() || rollback.relPath) }
              : t,
          ),
        );
        setTabDirty(rollback.relPath, "base", false);
      }

      if (prompt.rollbackFolderEntity) {
        const rollbackFolder = prompt.rollbackFolderEntity;
        await patchEntity(
          folderLocatorFromFolderPath(rollbackFolder.folderPath || ""),
          rollbackFolder.content as Record<string, unknown>,
        );

        setFolderEntities((list) => {
          const idx = list.findIndex((entry) => normalizeFolderPath(entry.folderPath || "") === normalizeFolderPath(rollbackFolder.folderPath || ""));
          if (idx < 0) return [...list, rollbackFolder];
          const clone = [...list];
          clone[idx] = rollbackFolder;
          return clone;
        });
        setSelectedFolderPath(normalizeFolderPath(rollbackFolder.folderPath || ""));
        setActiveWorkTab(`folder:${normalizeFolderPath(rollbackFolder.folderPath || "")}`);
      }

      setBaseActionPrompt(null);
    } catch (err) {
      showAppError("Undo failed", (err as Error).message);
    } finally {
      setApplyingBaseActions(false);
    }
  }, [applyingBaseActions, baseActionPrompt, formatBaseTitle, setActiveWorkTab, setBaseEntities, setBaseTabs, setFolderEntities, setSelectedFolderPath, setTabDirty, showAppError]);

  const handleSaveBase = useCallback(
    async (updated: BaseEntity) => {
      const previous = baseEntities.find((b) => b.relPath === updated.relPath);
      try {
        let hadMutation = false;
        const detectedUpdated = detectBaseType(updated.content, updated.relPath);
        const detectedPrevious = detectBaseType(previous?.content || {}, previous?.relPath || updated.relPath);
        const baseType = detectedUpdated.type !== "unknown" ? detectedUpdated.type : detectedPrevious.type;
        const nextItems = Array.isArray(detectedUpdated.items) ? detectedUpdated.items : [];
        const prevItems = Array.isArray(detectedPrevious.items) ? detectedPrevious.items : [];

        if (baseType && baseType !== "unknown") {
          assertNoDuplicateBaseKeys(baseType, nextItems);
          const previousByKey = new Map<string, Record<string, unknown>>();
          for (const item of prevItems) {
            const locator = buildBaseEntityLocator(baseType, item as Record<string, unknown>);
            if (!locator) continue;
            previousByKey.set(locator, item as Record<string, unknown>);
          }

          for (const item of nextItems) {
            const locator = buildBaseEntityLocator(baseType, item as Record<string, unknown>);
            if (!locator) continue;
            const prevItem = previousByKey.get(locator);
            if (prevItem) {
              if (!deepEqual(prevItem, item)) {
                await patchEntity(locator, item as Record<string, unknown>, { save: false });
                hadMutation = true;
              }
              previousByKey.delete(locator);
            } else {
              await createEntity(locator, item as Record<string, unknown>, { save: false });
              hadMutation = true;
            }
          }

          for (const [locator] of previousByKey) {
            await deleteEntity(locator, { save: false });
            hadMutation = true;
          }
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
        if (detected === "properties" && propertyValuesEntry) {
          const propDiff = diffPropertyChanges(previous?.content || {}, updated.content);
          if (propDiff.propertyRenames.length || propDiff.deletedProperties.length) {
            const renameMap = new Map<string, string>(
              propDiff.propertyRenames.map((rename) => [rename.oldName, rename.newName]),
            );
            const deletedProperties = new Set<string>(propDiff.deletedProperties);
            const peerPrevious = baseEntities.find((b) => b.relPath === propertyValuesEntry.relPath) || propertyValuesEntry;
            const peerValues = Array.isArray(peerPrevious.content?.propertyValues) ? peerPrevious.content.propertyValues : [];
            const nextPeerValues = peerValues
              .filter((entry: any) => !deletedProperties.has(`${entry?.property ?? ""}`))
              .map((entry: any) => {
                const currentProperty = `${entry?.property ?? ""}`;
                const nextProperty = renameMap.get(currentProperty);
                return nextProperty ? { ...entry, property: nextProperty } : entry;
              });
            const peerContent = { ...(peerPrevious.content || {}), propertyValues: nextPeerValues };
            if (!deepEqual(peerPrevious.content || {}, peerContent)) {
              const peerUpdated: BaseEntity = { ...peerPrevious, content: peerContent };
              const peerDetectedUpdated = detectBaseType(peerUpdated.content, peerUpdated.relPath);
              const peerDetectedPrevious = detectBaseType(peerPrevious.content || {}, peerPrevious.relPath);
              const peerType =
                peerDetectedUpdated.type !== "unknown" ? peerDetectedUpdated.type : peerDetectedPrevious.type;
              if (peerType && peerType !== "unknown") {
                const peerPrevItems = Array.isArray(peerDetectedPrevious.items) ? peerDetectedPrevious.items : [];
                const peerNextItems = Array.isArray(peerDetectedUpdated.items) ? peerDetectedUpdated.items : [];
                assertNoDuplicateBaseKeys(peerType, peerNextItems);
                const peerPreviousByKey = new Map<string, Record<string, unknown>>();
                for (const item of peerPrevItems) {
                  const locator = buildBaseEntityLocator(peerType, item as Record<string, unknown>);
                  if (!locator) continue;
                  peerPreviousByKey.set(locator, item as Record<string, unknown>);
                }
                for (const item of peerNextItems) {
                  const locator = buildBaseEntityLocator(peerType, item as Record<string, unknown>);
                  if (!locator) continue;
                  const prevItem = peerPreviousByKey.get(locator);
                  if (prevItem) {
                    if (!deepEqual(prevItem, item)) {
                      await patchEntity(locator, item as Record<string, unknown>, { save: false });
                      hadMutation = true;
                    }
                    peerPreviousByKey.delete(locator);
                  } else {
                    await createEntity(locator, item as Record<string, unknown>, { save: false });
                    hadMutation = true;
                  }
                }
                for (const [locator] of peerPreviousByKey) {
                  await deleteEntity(locator, { save: false });
                  hadMutation = true;
                }
              } else {
                const peerLocator = peerUpdated.locator || modelLocatorFromRelPath(peerUpdated.relPath);
                try {
                  await patchEntity(peerLocator, peerUpdated.content as Record<string, unknown>, { save: false });
                  hadMutation = true;
                } catch {
                  await createEntity(peerLocator, peerUpdated.content as Record<string, unknown>, { save: false });
                  hadMutation = true;
                }
              }
              setBaseEntities((list) => list.map((b) => (b.relPath === peerUpdated.relPath ? peerUpdated : b)));
              setBaseTabs((tabs) =>
                tabs.map((t) =>
                  t.relPath === peerUpdated.relPath
                    ? {
                        ...t,
                        dirty: false,
                        title: formatBaseTitle(peerUpdated.name || peerUpdated.relPath.split("/").pop() || peerUpdated.relPath),
                      }
                    : t,
                ),
              );
              setTabDirty(peerUpdated.relPath, "base", false);
            }
          }
        }
        if (previous?.content) {
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
          if (detected === "zones") {
            const zoneRenames = collectZoneFolderRenames(previous.content, updated.content);
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
            const zoneDeletes = collectZoneFolderDeletes(previous.content, updated.content);
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
            const propDiff = diffPropertyChanges(previous.content, updated.content);
            const payload: Partial<PropertyRefactorPayload> = {
              propertyRenames: propDiff.propertyRenames,
              deletedProperties: propDiff.deletedProperties,
            };
            const resolvedPayload = createPropertyRefactorPayload(payload);
            if (resolvedPayload) {
              const preview = summarizePropertyRefactorImpact(
                applyPropertyRefactorToModelEntities(modelEntities, resolvedPayload),
              );
              nextActions.push({
                kind: "propertyRefactor",
                payload,
                sourceRelPath: updated.relPath,
                preview: `Property refactor preview: ${preview.entityCount} entities, ${preview.changeCount} changes.`,
              });
            }
          }
          if (detected === "propertyValues") {
            const valueDiff = diffPropertyValueChanges(previous.content, updated.content);
            const payload: Partial<PropertyRefactorPayload> = {
              valueRenames: valueDiff.valueRenames,
              deletedValues: valueDiff.deletedValues,
              valueMoves: valueDiff.valueMoves,
            };
            const resolvedPayload = createPropertyRefactorPayload(payload);
            if (resolvedPayload) {
              const preview = summarizePropertyRefactorImpact(
                applyPropertyRefactorToModelEntities(modelEntities, resolvedPayload),
              );
              nextActions.push({
                kind: "propertyRefactor",
                payload,
                sourceRelPath: updated.relPath,
                preview: `Property value refactor preview: ${preview.entityCount} entities, ${preview.changeCount} changes.`,
              });
            }
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
            setBaseActionPrompt({
              sourceRelPath: updated.relPath,
              actions: uniqueActions,
              rollbackBaseEntity: {
                ...previous,
                content: JSON.parse(JSON.stringify(previous.content || {})),
              },
            });
          }
        }
        if (hadMutation) {
          await saveModel();
        }
      } catch (err) {
        setTabDirty(updated.relPath, "base", true);
        throw err;
      }
    },
    [
      baseEntities,
      modelEntities,
      baseActionKey,
      formatBaseTitle,
      propertyValuesEntry,
      setBaseEntities,
      setBaseActionPrompt,
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
      } catch (err) {
        showAppError("Move failed", (err as Error).message);
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
      showAppError,
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
        const message =
          typeof (payload as any)?.message === "string"
            ? (payload as any).message
            : typeof (payload as any)?.detail === "string"
              ? (payload as any).detail
              : `Reload failed (${reloadResponse.status})`;
        throw new Error(message);
      }
    } catch (err) {
      showAppError("Reload failed", (err as Error).message);
      return;
    }

    const fallbackSource: SolutionSource | null = solutionSource
      ? solutionSource
      : electronLike && solutionPath
        ? { kind: "electron-path", path: solutionPath }
        : { kind: "server-path", path: solutionPath || "" };
    const result = fallbackSource ? await loadSolution(fallbackSource) : undefined;
    if (result) {
      applyLoadedSolution(result);
    }
  }, [applyLoadedSolution, confirm, electronLike, hasAnyDirty, loadSolution, showAppError, solutionPath, solutionSource]);

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
        const currentFolderEntity = folderEntityByPath.get(currentFolderPath) || null;
        const rollbackFolderEntity = currentFolderEntity
          ? {
              ...currentFolderEntity,
              content: JSON.parse(JSON.stringify(currentFolderEntity.content || {})),
            }
          : null;
        setBaseActionPrompt({
          sourceRelPath: effectiveRelPath,
          actions: [
            {
              kind: "renameFolder",
              fromFolder: `Model/${currentFolderPath}`,
              toFolder: `Model/${targetFolderPath}`,
              sourceRelPath: effectiveRelPath,
              reason: "folderProperties",
            },
          ],
          rollbackBaseEntity: null,
          rollbackFolderEntity,
        });
      }
    },
    [folderEntityByPath, setActiveWorkTab, setBaseActionPrompt, setFolderEntities, setSelectedFolderPath],
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
  }, [ensureExpandedPath, folderEntityByPath, newFolderName, newFolderParentPath, saveFolderMetadata, setActiveWorkTab, setSelectedFolderPath, showAppError]);

  const deleteFolder = useCallback(
    async (folderPath: string) => {
      try {
        await deleteFolderTree(folderPath, {
          confirm: true,
          allowZoneRoot: false,
          notifySuccess: true,
          notifyFailure: true,
        });
      } catch {}
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

  const runValidator = useCallback(async () => {
    if (validatorRunInFlightRef.current) return;

    if (!solutionPath) {
      showAppError("No solution loaded", "Cannot run validator without a loaded solution.");
      return;
    }

    validatorRunInFlightRef.current = true;
    setValidatorRunning(true);
    setValidatorError(null);
    setValidatorMessages([]);
    setValidatorResolvedPath(null);

    try {
      const runValidateRequest = async (logLevel: string) => {
        const desktopValidate = window.desktop?.solution?.validate;
        if (desktopValidate) {
          const result = await desktopValidate({ solutionPath, logLevel });
          const payload = {
            messages: Array.isArray(result?.messages) ? result?.messages : result?.message ? [result.message] : [],
            solutionPath,
          } as Record<string, unknown>;
          return {
            response: new Response(JSON.stringify(payload), { status: result?.success === false ? 500 : 200 }),
            payload,
            messages: readValidateMessages(payload),
          };
        }

        const validateUrl = buildValidateUrl(apiBase, solutionPath, logLevel);
        const response = await fetch(validateUrl, { method: "POST" }).catch(() => null);
        if (response) {
          const payload = (await response.json().catch(() => ({}))) as ValidateResponse | Record<string, unknown>;
          const messages = readValidateMessages(payload);
          return { response, payload, messages };
        }

        throw new Error("Validate endpoint is not available.");
      };

      let { response, payload, messages } = await runValidateRequest(generatorLogLevel);

      if (
        response.ok &&
        messages.length === 0 &&
        generatorLogLevel !== "info"
      ) {
        const fallback = await runValidateRequest("info");
        if (fallback.response.ok && fallback.messages.length > 0) {
          response = fallback.response;
          payload = fallback.payload;
          messages = fallback.messages;
        }
      }

      if (!response.ok) {
        setValidatorMessages(messages);
        throw new Error(readValidateErrorMessage(payload, `Validation failed (${response.status}).`));
      }

      const resolvedPath = (payload as { solutionPath?: unknown }).solutionPath;
      setValidatorMessages(messages);
      setValidatorResolvedPath(
        typeof resolvedPath === "string" && resolvedPath.trim() ? resolvedPath.trim() : null,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unknown error occurred";
      setValidatorError(message);
      showAppError("Validator execution failed", message);
    } finally {
      validatorRunInFlightRef.current = false;
      setValidatorRunning(false);
    }
  }, [generatorLogLevel, showAppError, solutionPath]);

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
    });
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
    });
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

  useEffect(() => {
    setValidatorMessages([]);
    setValidatorResolvedPath(null);
    setValidatorError(null);
  }, [solutionPath]);

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
      <Dialog
        open={!!baseActionPrompt}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && baseActionPrompt) return;
        }}
      >
        <DialogContent
          className="max-w-xl"
          onEscapeKeyDown={(event) => {
            if (baseActionPrompt) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (baseActionPrompt) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Apply actions</DialogTitle>
            <DialogDescription>
              Base changes created follow-up actions. Apply them now to keep the model consistent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {baseActionPrompt?.actions?.length ? (
              baseActionPrompt.actions.slice(0, 8).map((action, idx) => (
                <div key={`${action.kind}-${idx}`} className="codex-popup-section px-3 py-2">
                  {action.kind === "renameFolder"
                    ? `Rename folder: ${action.fromFolder} -> ${action.toFolder}`
                    : action.kind === "deleteFolderTree"
                      ? `Delete folder tree: ${action.folderPath}`
                      : action.preview || "Run property refactor across entities"}
                </div>
              ))
            ) : (
              <div>No pending actions.</div>
            )}
            {(baseActionPrompt?.actions?.length || 0) > 8 ? (
              <div>{`...and ${(baseActionPrompt?.actions?.length || 0) - 8} more.`}</div>
            ) : null}
          </div>
          <DialogFooter className="border-t border-border/70 pt-4">
            <Button
              type="button"
              variant="ghost"
              disabled={applyingBaseActions}
              onClick={() => {
                void undoBaseActionPrompt();
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!baseActionPrompt || baseActionPrompt.actions.length === 0 || applyingBaseActions}
              onClick={() => {
                void (async () => {
                  await applyPendingBaseActions();
                })();
              }}
            >
              {applyingBaseActions ? "Applying..." : `Apply ${baseActionPrompt?.actions?.length || 0} Action(s)`}
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
            onAddEntity={() => setWizardOpen(true)}
            onToggleTheme={handleToggleTheme}
            resolvedTheme={resolvedTheme}
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
                  className={`icon-btn workspace-header__run-toggle ${activeRunPanel === "generator" ? "icon-btn--active" : ""}`}
                  onClick={() => {
                    setActiveRunPanel((prev) => (prev === "generator" ? null : "generator"));
                  }}
                  aria-label="Toggle generator"
                  title="Generator"
                >
                  <Bot className={`workspace-header__run-icon h-4 w-4 ${activeRunPanel === "generator" ? "workspace-header__run-icon--active" : ""}`} />
                </button>
                <button
                  type="button"
                  className={`icon-btn workspace-header__run-toggle ${activeRunPanel === "validator" ? "icon-btn--active" : ""}`}
                  onClick={() => {
                    setActiveRunPanel((prev) => (prev === "validator" ? null : "validator"));
                  }}
                  aria-label="Toggle validator"
                  title="Validator"
                >
                  <ShieldCheck className={`workspace-header__run-icon h-4 w-4 ${activeRunPanel === "validator" ? "workspace-header__run-icon--active" : ""}`} />
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
                running={generatorRunning}
                log={generatorLog}
                stderr={generatorStderr}
                exitCode={generatorExit}
                error={generatorError}
              />
            </div>
          </div>

          <div className={`run-panel-shell ${activeRunPanel === "validator" ? "run-panel-shell--active" : ""}`}>
            <div className="validator-panel">
              <ValidatorPanel
                running={validatorRunning}
                messages={validatorMessages}
                resolvedSolutionPath={validatorResolvedPath}
                error={validatorError}
                canRun={!!solutionPath}
                onRun={runValidator}
              />
            </div>
          </div>
          <div className="error-surface-slot">
            <ErrorSurfaceHost scope="app" />
          </div>
        </section>
      </div>
    </div>
  );
}



