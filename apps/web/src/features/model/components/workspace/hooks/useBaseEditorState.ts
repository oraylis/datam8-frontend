import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { BaseEntity, PropertyOption } from "../../../model-types";
import { detectBaseType } from "../../../model-utils";
import {
  findBaseItemIndex,
  getBaseItemLegacySelectionKey,
  getBaseItemSelectionKey,
  isBaseItemSelected,
} from "../lib/baseItemSelection";
import { validateBaseContent } from "../lib/validation";
import { deepEqual } from "../../../../../shared/utils/deepEqual";
import { useSaveFailureToast } from "../../../../../shared/ui/useSaveFailureToast";
import { useErrorSurface } from "../../../../../shared/ui/ErrorSurface";

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null));
const baseSelectedItemMemory = new Map<string, string | null>();

const nextPlaceholderName = (prefix: string, items: any[]) => {
  const used = new Set(
    (Array.isArray(items) ? items : [])
      .map((item) => `${item?.name ?? ""}`.trim().toLowerCase())
      .filter(Boolean),
  );

  let index = 1;
  while (used.has(`${prefix}${index}`.toLowerCase())) {
    index += 1;
  }
  return `${prefix}${index}`;
};

const firstNonEmpty = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = `${value ?? ""}`.trim();
    if (text) return text;
  }
  return "";
};

type BaseEditorDraft = {
  baseDraft: any;
  baseMode: "form" | "json";
  baseJsonText: string;
  selectedBaseItem: string | null;
  openValueDetails: Record<string, boolean>;
  selectedDataModule: string | null;
};

type BaseStateParams = {
  baseEntities: BaseEntity[];
  selectedBase: BaseEntity | null;
  onSelectBase: (relPath: string, title?: string) => void;
  onSaveBase: (updated: BaseEntity) => Promise<void>;
  onDirtyBase: (relPath: string, dirty: boolean) => void;
  baseItemSelectionRequest?: { relPath: string; itemName: string; token: number } | null;
  propertyOptions: PropertyOption[];
  generatorTargets: string[];
  dataTypes: string[];
  getBaseDraft: (relPath: string) => BaseEditorDraft | null;
  setBaseEditorDraft: (relPath: string, draft: BaseEditorDraft | null) => void;
};

export type PersistReason =
  | "text-blur"
  | "dropdown-change"
  | "tab-switch"
  | "add-item"
  | "delete-item"
  | "undo-delete";

export const shouldAllowIncompleteBaseDraftTransition = (reason: PersistReason): boolean => reason !== "tab-switch";

const isPropertyValuesBase = (b?: BaseEntity | null) => {
  if (!b) return false;
  return detectBaseType(b.content, b.relPath).type === "propertyValues";
};

export const useBaseEditorState = ({
  baseEntities,
  selectedBase,
  onSelectBase,
  onSaveBase,
  onDirtyBase,
  baseItemSelectionRequest,
  propertyOptions,
  generatorTargets,
  dataTypes,
  getBaseDraft,
  setBaseEditorDraft,
}: BaseStateParams) => {
  const { showError } = useErrorSurface();
  const propertyValuesEntry = useMemo(() => baseEntities.find((b) => isPropertyValuesBase(b)), [baseEntities]);

  const [selectedBaseItemState, setSelectedBaseItemState] = useState<string | null>(null);
  const [baseDraft, setBaseDraft] = useState<any | null>(null);
  const [baseMode, setBaseMode] = useState<"form" | "json">("form");
  const [baseJsonText, setBaseJsonText] = useState("");
  const [openValueDetails, setOpenValueDetails] = useState<Record<string, boolean>>({});
  const [selectedDataModule, setSelectedDataModule] = useState<string | null>(null);
  const [baseSaveStatus, setBaseSaveStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [baseSaveError, setBaseSaveError] = useState<string | null>(null);
  const originalBaseRef = useRef<any | null>(null);
  const draftRelPathRef = useRef<string | null>(null);
  const lastBaseRelRef = useRef<string | null>(null);
  const lastBaseContentKeyRef = useRef<string>("");
  const lastHandledBaseItemRequestRef = useRef<number | null>(null);
  const selectedItemByRelPathRef = useRef<Record<string, string | null>>({});
  const hydratingSelectionRef = useRef<boolean>(false);
  const hydrationFrameRef = useRef<number | null>(null);
  const baselineReadyRef = useRef<boolean>(false);
  const skipNextDirtyRef = useRef<boolean>(false);
  const baseDirtyRef = useRef(false);
  const persistInFlightRef = useRef(false);
  const persistQueuedRef = useRef(false);
  const pendingPersistReasonRef = useRef<PersistReason | null>(null);
  const pendingPersistRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  const [changeRevision, setChangeRevision] = useState(0);

  const bumpChangeRevision = useCallback(() => {
    const next = changeRevisionRef.current + 1;
    changeRevisionRef.current = next;
    setChangeRevision(next);
  }, []);

  const scheduleHydrationRelease = useCallback(() => {
    if (typeof window === "undefined") {
      hydratingSelectionRef.current = false;
      return;
    }
    if (hydrationFrameRef.current !== null) {
      window.cancelAnimationFrame(hydrationFrameRef.current);
    }
    hydrationFrameRef.current = window.requestAnimationFrame(() => {
      hydratingSelectionRef.current = false;
      hydrationFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && hydrationFrameRef.current !== null) {
        window.cancelAnimationFrame(hydrationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    baseDirtyRef.current = false;
    persistQueuedRef.current = false;
    pendingPersistReasonRef.current = null;
    pendingPersistRevisionRef.current = 0;
    changeRevisionRef.current = 0;
    setChangeRevision(0);
  }, [selectedBase?.relPath]);

  const validateBaseDraft = useCallback((type: string, content: any) => validateBaseContent(type, content), []);

  const setSelectedBaseItem = useCallback((next: SetStateAction<string | null>) => {
    setSelectedBaseItemState((prev) => {
      const resolved = typeof next === "function" ? (next as (value: string | null) => string | null)(prev) : next;
      if (selectedBase?.relPath) {
        selectedItemByRelPathRef.current[selectedBase.relPath] = resolved ?? null;
        baseSelectedItemMemory.set(selectedBase.relPath, resolved ?? null);
      }
      return resolved;
    });
  }, [selectedBase?.relPath]);

  const selectedBaseItem = selectedBaseItemState;

  const markBaseDirty = useCallback(() => {
    baseDirtyRef.current = true;
    bumpChangeRevision();
  }, [bumpChangeRevision]);

  useLayoutEffect(() => {
    if (!selectedBase) return;
    hydratingSelectionRef.current = true;
    const previousRelPath = lastBaseRelRef.current;
    if (
      previousRelPath &&
      previousRelPath !== selectedBase.relPath &&
      baselineReadyRef.current &&
      draftRelPathRef.current === previousRelPath
    ) {
      const selectedForPrevious =
        baseSelectedItemMemory.get(previousRelPath) ?? selectedItemByRelPathRef.current[previousRelPath] ?? selectedBaseItem ?? null;
      selectedItemByRelPathRef.current[previousRelPath] = selectedForPrevious;
      baseSelectedItemMemory.set(previousRelPath, selectedForPrevious);
      const previousDraft: BaseEditorDraft = {
        baseDraft: cloneDeep(baseDraft || {}),
        baseMode,
        baseJsonText,
        selectedBaseItem: selectedForPrevious,
        openValueDetails: cloneDeep(openValueDetails),
        selectedDataModule,
      };
      setBaseEditorDraft(previousRelPath, previousDraft);
    }

    const combinedContent = {
      ...(selectedBase.content || {}),
    };

    const baseContentKey = JSON.stringify(selectedBase.content || {});
    const relChanged = selectedBase.relPath !== lastBaseRelRef.current;
    const baseChanged = baseContentKey !== lastBaseContentKeyRef.current;

    if (!relChanged && !baseChanged) {
      hydratingSelectionRef.current = false;
      return;
    }

    const isSyncedPatch = !relChanged && baseChanged && baseDraft && deepEqual(combinedContent, baseDraft);
    if (isSyncedPatch) {
      draftRelPathRef.current = selectedBase.relPath;
      lastBaseRelRef.current = selectedBase.relPath;
      lastBaseContentKeyRef.current = baseContentKey;
      hydratingSelectionRef.current = false;
      return;
    }

    baselineReadyRef.current = false;

    originalBaseRef.current = cloneDeep(selectedBase.content);
    lastBaseRelRef.current = selectedBase.relPath;
    lastBaseContentKeyRef.current = baseContentKey;
    const restored = relChanged ? getBaseDraft(selectedBase.relPath) : null;
    if (restored) {
      const restoredContent = cloneDeep(restored.baseDraft || combinedContent);
      const restoredSelectedItem =
        restored.selectedBaseItem ??
        baseSelectedItemMemory.get(selectedBase.relPath) ??
        selectedItemByRelPathRef.current[selectedBase.relPath] ??
        null;
      skipNextDirtyRef.current = false;
      setBaseDraft(restoredContent);
      setBaseJsonText(
        typeof restored.baseJsonText === "string" ? restored.baseJsonText : JSON.stringify(restoredContent, null, 2),
      );
      setBaseMode(restored.baseMode || "form");
      setSelectedBaseItem(restoredSelectedItem);
      setOpenValueDetails(cloneDeep(restored.openValueDetails || {}));
      setSelectedDataModule(restored.selectedDataModule || null);
      setBaseSaveStatus("idle");
      setBaseSaveError(null);
      draftRelPathRef.current = selectedBase.relPath;
      selectedItemByRelPathRef.current[selectedBase.relPath] = restoredSelectedItem;
      baseSelectedItemMemory.set(selectedBase.relPath, restoredSelectedItem);
      baselineReadyRef.current = true;
      scheduleHydrationRelease();
      return;
    }

    skipNextDirtyRef.current = true;
    setBaseDraft(combinedContent);
    setBaseJsonText(JSON.stringify(combinedContent, null, 2));
    if (relChanged) {
      setBaseMode("form");
      const remembered = baseSelectedItemMemory.get(selectedBase.relPath) ?? selectedItemByRelPathRef.current[selectedBase.relPath] ?? null;
      setSelectedBaseItem(remembered);
      setOpenValueDetails({});
      setSelectedDataModule(null);
    }
    setBaseSaveStatus("idle");
    setBaseSaveError(null);
    draftRelPathRef.current = selectedBase.relPath;
    baselineReadyRef.current = true;
    selectedItemByRelPathRef.current[selectedBase.relPath] =
      selectedItemByRelPathRef.current[selectedBase.relPath] ?? null;
    baseSelectedItemMemory.set(
      selectedBase.relPath,
      baseSelectedItemMemory.get(selectedBase.relPath) ?? selectedItemByRelPathRef.current[selectedBase.relPath] ?? null,
    );
    scheduleHydrationRelease();
  }, [
    baseDraft,
    baseJsonText,
    baseMode,
    getBaseDraft,
    openValueDetails,
    selectedBase,
    selectedBaseItem,
    selectedDataModule,
    scheduleHydrationRelease,
    setBaseEditorDraft,
  ]);

  useEffect(() => {
    if (selectedBase) {
      setBaseSaveStatus("idle");
      setBaseSaveError(null);
    }
  }, [selectedBase]);

  const baseData = useMemo(() => {
    if (!baseDraft || !selectedBase) {
      return {
        type: "unknown",
        items: [] as any[],
        propertyValues: [] as any[],
      };
    }
    return detectBaseType(baseDraft, selectedBase.relPath);
  }, [baseDraft, selectedBase]);

  const baseValidation = useMemo(
    () => validateBaseDraft(baseData.type, baseDraft || selectedBase?.content || {}),
    [baseData.type, baseDraft, selectedBase, validateBaseDraft],
  );

  const isMissingField = useCallback(
    (key: string, field: string) => !!baseValidation.missing[key]?.has(field),
    [baseValidation.missing],
  );

  useEffect(() => {
    if (!selectedBase || !baselineReadyRef.current) return;
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false;
      return;
    }

    let parseError = false;
    let currentContent: any = baseDraft || selectedBase.content || {};
    if (baseMode === "json") {
      try {
        currentContent = JSON.parse(baseJsonText);
      } catch {
        parseError = true;
      }
    }

    const baseDirty = parseError || !deepEqual(currentContent, originalBaseRef.current);
    baseDirtyRef.current = baseDirty;
    if (!baseDirty) {
      persistQueuedRef.current = false;
      pendingPersistReasonRef.current = null;
      pendingPersistRevisionRef.current = 0;
      setBaseSaveStatus("idle");
      setBaseSaveError(null);
    }
  }, [
    baseDraft,
    baseJsonText,
    baseMode,
    selectedBase,
  ]);

  useEffect(() => {
    if (!selectedBase || !baselineReadyRef.current || draftRelPathRef.current !== selectedBase.relPath) return;
    selectedItemByRelPathRef.current[selectedBase.relPath] = selectedBaseItem ?? null;
    baseSelectedItemMemory.set(selectedBase.relPath, selectedBaseItem ?? null);
    const draft: BaseEditorDraft = {
      baseDraft: cloneDeep(baseDraft || selectedBase.content || {}),
      baseMode,
      baseJsonText,
      selectedBaseItem,
      openValueDetails: cloneDeep(openValueDetails),
      selectedDataModule,
    };
    setBaseEditorDraft(selectedBase.relPath, draft);
  }, [
    baseDraft,
    baseJsonText,
    baseMode,
    openValueDetails,
    selectedBase,
    selectedBaseItem,
    selectedDataModule,
    setBaseEditorDraft,
  ]);

  useEffect(() => {
    if (!selectedBase || !baselineReadyRef.current || draftRelPathRef.current !== selectedBase.relPath) return;
    if (hydratingSelectionRef.current) return;
    const expectedType = detectBaseType(selectedBase.content || {}, selectedBase.relPath).type;
    if (baseData.type !== expectedType) return;
    const items = baseData.items || [];
    const remembered =
      baseSelectedItemMemory.get(selectedBase.relPath) ??
      selectedItemByRelPathRef.current[selectedBase.relPath] ??
      null;
    if (items.length === 0) {
      setSelectedBaseItem(null);
      return;
    }
    if (remembered) {
      const rememberedIndex = findBaseItemIndex(items, remembered);
      if (rememberedIndex >= 0) {
        const nextRemembered = getBaseItemSelectionKey(items[rememberedIndex], rememberedIndex);
        if (selectedBaseItem !== nextRemembered) {
          setSelectedBaseItem(nextRemembered);
        }
        return;
      }
    }
    const selectedIndex = findBaseItemIndex(items, selectedBaseItem);
    if (!selectedBaseItem || selectedIndex < 0) {
      setSelectedBaseItem(getBaseItemSelectionKey(items[0], 0));
    }
  }, [baseData, selectedBase, selectedBaseItem]);

  useEffect(() => {
    const request = baseItemSelectionRequest;
    if (!request || !selectedBase) return;
    if (lastHandledBaseItemRequestRef.current === request.token) return;
    if (selectedBase.relPath !== request.relPath) return;

    const items = baseData.items || [];
    const targetIndex = items.findIndex(
      (item: any, idx: number) =>
        getBaseItemLegacySelectionKey(item) === request.itemName ||
        (typeof item?.name === "string" && item.name.trim() === request.itemName) ||
        isBaseItemSelected(item, idx, request.itemName),
    );
    if (targetIndex < 0) return;

    setSelectedBaseItem(getBaseItemSelectionKey(items[targetIndex], targetIndex));
    setBaseMode("form");
    lastHandledBaseItemRequestRef.current = request.token;
  }, [baseData.items, baseItemSelectionRequest, selectedBase]);

  const setDraftListForType = (draft: any, type: string, nextList: any[]) => {
    switch (type) {
      case "attributeTypes":
        draft.attributeTypes = nextList;
        break;
      case "dataTypes":
        draft.dataTypes = nextList;
        break;
      case "dataSources":
        draft.dataSources = nextList;
        break;
      case "dataSourceTypes":
        draft.dataSourceTypes = nextList;
        break;
      case "dataProducts":
        draft.dataProducts = nextList;
        break;
      case "zones":
        draft.zones = nextList;
        break;
      case "properties":
        draft.properties = nextList;
        break;
      case "propertyValues":
        draft.propertyValues = nextList;
        break;
      default:
        break;
    }
  };

  const addBaseItem = useCallback(() => {
    if (!selectedBase) return;
    const draft = { ...(baseDraft || selectedBase.content || {}) };
    const type = baseData.type;
    const currentList = Array.isArray(baseData.items) ? baseData.items : [];
    let nextItem: any = null;
    const dataSourceTypesEntry = baseEntities.find((b) => b.name === "DataSourceTypes");
    const availableDataSourceTypes = Array.isArray(dataSourceTypesEntry?.content?.dataSourceTypes)
      ? dataSourceTypesEntry.content.dataSourceTypes
      : [];
    const defaultDataSourceTypeName = firstNonEmpty(availableDataSourceTypes[0]?.name, "DefaultSourceType");

    switch (type) {
      case "attributeTypes": {
        const name = nextPlaceholderName("AttributeType", currentList);
        nextItem = { name, displayName: name, defaultType: firstNonEmpty(dataTypes?.[0], "") };
        draft.attributeTypes = [...currentList, nextItem];
        break;
      }
      case "dataTypes": {
        const name = nextPlaceholderName("DataType", currentList);
        const targetName = firstNonEmpty(generatorTargets?.[0], "default");
        nextItem = { name, targets: { [targetName]: name } };
        draft.dataTypes = [...currentList, nextItem];
        break;
      }
      case "dataSources": {
        const name = nextPlaceholderName("DataSource", currentList);
        nextItem = { name, type: defaultDataSourceTypeName, extendedProperties: {} };
        draft.dataSources = [...currentList, nextItem];
        break;
      }
      case "dataSourceTypes": {
        const name = nextPlaceholderName("DataSourceType", currentList);
        const defaultType = firstNonEmpty(dataTypes?.[0], "string");
        const defaultConnectionProperty = "host";
        nextItem = {
          name,
          dataTypeMapping: [{ sourceType: defaultType, targetType: defaultType }],
          connectionProperties: [{ name: defaultConnectionProperty, required: true, type: "string" }],
          authModes: [{ name: "default", required: [defaultConnectionProperty], optional: [] }],
        };
        draft.dataSourceTypes = [...currentList, nextItem];
        break;
      }
      case "dataProducts": {
        const name = nextPlaceholderName("DataProduct", currentList);
        nextItem = {
          name,
          dataModules: [{ name: "Module1", displayName: "Module1", properties: [] }],
        };
        draft.dataProducts = [...currentList, nextItem];
        break;
      }
      case "zones": {
        const name = nextPlaceholderName("Zone", currentList);
        nextItem = { name, targetName: name.toLowerCase(), displayName: name, properties: [] };
        draft.zones = [...currentList, nextItem];
        break;
      }
      case "properties": {
        const name = nextPlaceholderName("Property", currentList);
        nextItem = { name, displayName: name, schema: "", scopes: [] };
        draft.properties = [...currentList, nextItem];
        break;
      }
      case "propertyValues": {
        const propertyName = firstNonEmpty(propertyOptions?.[0]?.name, "Property1");
        const existingForProperty = currentList.filter(
          (item: any) => `${item?.property ?? ""}`.trim().toLowerCase() === propertyName.toLowerCase(),
        );
        const name = nextPlaceholderName("Value", existingForProperty);
        nextItem = {
          property: propertyName,
          name,
          displayName: name,
          default: false,
        };
        draft.propertyValues = [...currentList, nextItem];
        break;
      }
      default:
        return;
    }
    if (!nextItem) return;
    setBaseDraft(draft);
    setSelectedBaseItem(getBaseItemSelectionKey(nextItem, currentList.length));
    setBaseMode("form");
    markBaseDirty();
  }, [
    baseData.items,
    baseData.type,
    baseDraft,
    baseEntities,
    dataTypes,
    generatorTargets,
    markBaseDirty,
    propertyOptions,
    selectedBase,
  ]);

  const removeBaseItem = useCallback(
    (itemKey: string, opts?: { confirm?: boolean }) => {
      if (!selectedBase) return null;
      const requiresAtLeastOne = ["attributeTypes", "dataTypes", "dataSourceTypes", "dataProducts"].includes(baseData.type);
      const currentList = baseData.items || [];
      if (requiresAtLeastOne && currentList.length <= 1) {
        showError("app", {
          title: "Delete blocked",
          description: "At least one item is required and cannot be removed.",
        });
        return null;
      }
      const targetIndex = findBaseItemIndex(currentList, itemKey);
      if (targetIndex < 0) return null;
      const targetLabel = getBaseItemLegacySelectionKey(currentList[targetIndex]);
      if (opts?.confirm !== false && !window.confirm(`Remove ${targetLabel}?`)) return null;

      const prevDraft = cloneDeep(baseDraft || selectedBase.content || {});
      const draft = { ...(baseDraft || selectedBase.content || {}) };
      const filtered = currentList.filter((_i: any, idx: number) => idx !== targetIndex);
      setDraftListForType(draft, baseData.type, filtered);

      setBaseDraft(draft);
      const nextSelected = filtered.length ? getBaseItemSelectionKey(filtered[0], 0) : null;
      setSelectedBaseItem(nextSelected);
      markBaseDirty();

      return {
        removedName: targetLabel,
        undo: () => {
          setBaseDraft(prevDraft);
          const restoredItem = currentList[targetIndex];
          setSelectedBaseItem(getBaseItemSelectionKey(restoredItem, targetIndex));
          setBaseMode("form");
          markBaseDirty();
        },
      };
    },
    [baseData.items, baseData.type, baseDraft, markBaseDirty, selectedBase, showError],
  );

  const onSubmitBase = useCallback(async (): Promise<boolean> => {
    if (!selectedBase) return false;
    setBaseSaveStatus("saving");
    setBaseSaveError(null);
    try {
      const latest = baseEntities.find((b) => b.relPath === selectedBase.relPath) || selectedBase;
      const expectedType = detectBaseType(latest.content, selectedBase.relPath).type;
      const stateMatchesSelection =
        baselineReadyRef.current && draftRelPathRef.current === selectedBase.relPath;
      let usedLatestFallback = false;

      let content = stateMatchesSelection ? (baseDraft || latest.content) : latest.content;
      if (!stateMatchesSelection) {
        usedLatestFallback = true;
      }
      if (stateMatchesSelection && baseMode === "json") {
        content = JSON.parse(baseJsonText);
      }
      let detected = detectBaseType(content, selectedBase.relPath);

      // During Save All, tab switching can invoke save before the form draft has synced to the new base file.
      // In form mode this indicates stale state; use the latest content for the selected relPath instead.
      if (baseMode === "form" && detected.type !== expectedType) {
        content = latest.content;
        detected = detectBaseType(content, selectedBase.relPath);
        usedLatestFallback = true;
      }

      if (detected.type === "dataSources") {
        const normalizedSources = (content?.dataSources || []).map((ds: any) => ({
          ...(ds || {}),
          type: ds?.type ?? ds?.dataSourceType ?? "",
        }));
        content = { ...(content || {}), dataSources: normalizedSources };
      }

      const validation = validateBaseDraft(detected.type, content);
      if (validation.errors.length || Object.keys(validation.missing).length) {
        setBaseSaveStatus("idle");
        setBaseSaveError(null);
        onDirtyBase(selectedBase.relPath, true);
        return true;
      }

      await onSaveBase({ ...latest, content });
      originalBaseRef.current = cloneDeep(content);
      lastBaseContentKeyRef.current = JSON.stringify(content || {});
      if (usedLatestFallback) {
        setBaseDraft(content);
        setBaseJsonText(JSON.stringify(content, null, 2));
        draftRelPathRef.current = selectedBase.relPath;
      }
      setBaseSaveStatus("success");
      skipNextDirtyRef.current = true;
      baseDirtyRef.current = false;
      onDirtyBase(selectedBase.relPath, false);
      setTimeout(() => setBaseSaveStatus("idle"), 1500);
      return true;
    } catch (err) {
      setBaseSaveStatus("error");
      setBaseSaveError((err as Error).message);
      onDirtyBase(selectedBase.relPath, true);
      return false;
    }
  }, [baseDraft, baseEntities, baseJsonText, baseMode, onDirtyBase, onSaveBase, selectedBase, validateBaseDraft]);

  const hasIncompleteBaseRequiredDraft = useCallback((): boolean => {
    if (!selectedBase || baseMode === "json") return false;
    const content = baseDraft || selectedBase.content || {};
    const detected = detectBaseType(content, selectedBase.relPath);
    const validation = validateBaseDraft(detected.type, content);
    return validation.errors.length > 0 || Object.keys(validation.missing).length > 0;
  }, [baseDraft, baseMode, selectedBase, validateBaseDraft]);

  const persistNow = useCallback(
    async (reason: PersistReason): Promise<boolean> => {
      if (!selectedBase || !baseDirtyRef.current) return true;
      if (hasIncompleteBaseRequiredDraft()) {
        onDirtyBase(selectedBase.relPath, true);
        setBaseSaveStatus("idle");
        setBaseSaveError(null);
        return shouldAllowIncompleteBaseDraftTransition(reason);
      }
      if (persistInFlightRef.current) {
        persistQueuedRef.current = true;
        return false;
      }
      persistInFlightRef.current = true;
      const ok = await onSubmitBase();
      persistInFlightRef.current = false;
      if (persistQueuedRef.current && baseDirtyRef.current) {
        persistQueuedRef.current = false;
        return persistNow("tab-switch");
      }
      return ok;
    },
    [hasIncompleteBaseRequiredDraft, onDirtyBase, onSubmitBase, selectedBase],
  );

  const persistAfterStateFlush = useCallback(
    (reason: PersistReason) => {
      pendingPersistReasonRef.current = reason;
      pendingPersistRevisionRef.current = changeRevisionRef.current;
    },
    [],
  );

  useEffect(() => {
    const reason = pendingPersistReasonRef.current;
    if (!reason) return;
    if (changeRevision < pendingPersistRevisionRef.current) return;
    pendingPersistReasonRef.current = null;
    pendingPersistRevisionRef.current = 0;
    void persistNow(reason);
  }, [changeRevision, persistNow]);

  const retrySave = useCallback(() => {
    void persistNow("tab-switch");
  }, [persistNow]);

  const { notifySaveFailure, resetSaveFailureToastMemory } = useSaveFailureToast({
    contextKey: `base:${selectedBase?.relPath || "none"}`,
    onRetry: retrySave,
  });

  useEffect(() => {
    if (baseSaveStatus === "error") {
      notifySaveFailure(baseSaveError);
      return;
    }
    resetSaveFailureToastMemory();
  }, [baseSaveError, baseSaveStatus, notifySaveFailure, resetSaveFailureToastMemory]);

  const dataSourceTypes = useMemo(() => {
    const entry = baseEntities.find((b) => (b.name || "").toLowerCase().includes("datasourcetypes"));
    const content =
      selectedBase && entry && selectedBase.relPath === entry.relPath && baseDraft ? baseDraft : entry?.content;
    return content?.dataSourceTypes || [];
  }, [baseEntities, selectedBase, baseDraft]);

  return {
    propertyValuesEntry,
    selectedBaseItem,
    setSelectedBaseItem,
    baseDraft,
    setBaseDraft,
    baseMode,
    setBaseMode,
    baseJsonText,
    setBaseJsonText,
    openValueDetails,
    setOpenValueDetails,
    selectedDataModule,
    setSelectedDataModule,
    baseSaveStatus,
    baseSaveError,
    markBaseDirty,
    isMissingField,
    baseData,
    addBaseItem,
    removeBaseItem,
    onSubmitBase,
    persistNow,
    persistAfterStateFlush,
    retrySave,
    propertyOptions,
    generatorTargets,
    dataTypes,
    dataSourceTypes,
  };
};
