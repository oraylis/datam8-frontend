import { useCallback, type MutableRefObject } from "react";
import type { BaseEntity, BaseTab, ModelTab } from "../model-types";
import { normalizeFolderPath } from "../model-utils";

type Kind = "entity" | "base";

type SaveRefs = {
  entitySaveRef: MutableRefObject<() => Promise<void>>;
  baseSaveRef: MutableRefObject<{ relPath: string | null; save: () => Promise<void> }>;
  folderSaveRef: MutableRefObject<{ folderPath: string | null; save: () => Promise<void> }>;
  activeWorkTabRef: MutableRefObject<string | null>;
  selectedRelPathRef: MutableRefObject<string | null>;
  selectedBaseRelPathRef: MutableRefObject<string | null>;
};

export function computeBaseSaveCountFor(args: {
  relPath: string;
  baseEntities: BaseEntity[];
}): number {
  const { relPath, baseEntities } = args;
  const base = baseEntities.find((b) => b.relPath === relPath);
  if (!base) return 1;
  return 1;
}

function waitForCondition(predicate: () => boolean, maxAttempts = 120): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let attempts = 0;
    const check = () => {
      if (predicate()) {
        resolve(true);
        return;
      }
      attempts += 1;
      if (attempts > maxAttempts) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

type UseSaveCoordinatorParams = SaveRefs & {
  activeWorkTab: string | null;
  modelTabs: ModelTab[];
  baseTabs: BaseTab[];
  dirtyFolderPaths: Set<string>;
  baseEntities: BaseEntity[];
  focusEntityTab: (relPath: string) => void;
  focusBaseTab: (relPath: string) => void;
  setSelectedFolderPath: (path: string | null) => void;
  setActiveWorkTab: (tab: string | null) => void;
  startBulkSave: (total: number) => void;
  finalizeBulkSave: () => void;
};

export function useSaveCoordinator({
  activeWorkTab,
  modelTabs,
  baseTabs,
  dirtyFolderPaths,
  baseEntities,
  focusEntityTab,
  focusBaseTab,
  setSelectedFolderPath,
  setActiveWorkTab,
  startBulkSave,
  finalizeBulkSave,
  entitySaveRef,
  baseSaveRef,
  folderSaveRef,
  activeWorkTabRef,
  selectedRelPathRef,
  selectedBaseRelPathRef,
}: UseSaveCoordinatorParams) {
  const waitForSelection = useCallback(
    (kind: Kind, relPath: string) =>
      waitForCondition(() => {
        const target = `${kind}:${relPath}`;
        if (activeWorkTabRef.current !== target) return false;
        if (kind === "entity") return selectedRelPathRef.current === relPath;
        return selectedBaseRelPathRef.current === relPath;
      }),
    [activeWorkTabRef, selectedBaseRelPathRef, selectedRelPathRef],
  );

  const waitForBaseSaver = useCallback(
    (relPath: string) => waitForCondition(() => baseSaveRef.current.relPath === relPath),
    [baseSaveRef],
  );

  const waitForFolderSaver = useCallback(
    (folderPath: string) =>
      waitForCondition(() => folderSaveRef.current.folderPath === normalizeFolderPath(folderPath)),
    [folderSaveRef],
  );

  const computeBaseSaveCount = useCallback(
    (relPath: string) =>
      computeBaseSaveCountFor({
        relPath,
        baseEntities,
      }),
    [baseEntities],
  );

  const saveActiveTab = useCallback(async () => {
    if (activeWorkTab?.startsWith("entity:")) {
      await entitySaveRef.current();
      return;
    }
    if (activeWorkTab?.startsWith("base:")) {
      const relPath = activeWorkTab.replace("base:", "");
      const total = computeBaseSaveCount(relPath);
      if (total > 1) startBulkSave(total);
      try {
        const ready = await waitForBaseSaver(relPath);
        if (!ready) return;
        await baseSaveRef.current.save();
      } finally {
        if (total > 1) finalizeBulkSave();
      }
      return;
    }
    if (activeWorkTab?.startsWith("folder:")) {
      const folderPath = normalizeFolderPath(activeWorkTab.replace("folder:", ""));
      if (!folderPath) return;
      if (folderSaveRef.current.folderPath !== folderPath) {
        const ready = await waitForFolderSaver(folderPath);
        if (!ready) return;
      }
      await folderSaveRef.current.save();
    }
  }, [activeWorkTab, baseSaveRef, computeBaseSaveCount, entitySaveRef, finalizeBulkSave, folderSaveRef, startBulkSave, waitForFolderSaver]);

  const saveAll = useCallback(async () => {
    const dirtyModels = modelTabs.filter((t) => t.dirty);
    const dirtyBases = baseTabs.filter((t) => t.dirty);
    const dirtyFolders = Array.from(dirtyFolderPaths);
    const bulkTotal = dirtyModels.length + dirtyBases.reduce((acc, tab) => acc + computeBaseSaveCount(tab.relPath), 0);
    if (bulkTotal === 0 && dirtyFolders.length === 0) return;
    if (bulkTotal > 0) startBulkSave(bulkTotal);
    try {
      for (const tab of dirtyModels) {
        focusEntityTab(tab.relPath);
        const selected = await waitForSelection("entity", tab.relPath);
        if (!selected) continue;
        await entitySaveRef.current();
      }
      for (const tab of dirtyBases) {
        focusBaseTab(tab.relPath);
        const selected = await waitForSelection("base", tab.relPath);
        if (!selected) continue;
        const ready = await waitForBaseSaver(tab.relPath);
        if (!ready) continue;
        await baseSaveRef.current.save();
      }
      for (const folderPath of dirtyFolders) {
        setSelectedFolderPath(folderPath);
        setActiveWorkTab(`folder:${folderPath}`);
        const ready = await waitForFolderSaver(folderPath);
        if (!ready) continue;
        await folderSaveRef.current.save();
      }
    } finally {
      if (bulkTotal > 0) finalizeBulkSave();
    }
  }, [
    baseSaveRef,
    baseTabs,
    computeBaseSaveCount,
    dirtyFolderPaths,
    entitySaveRef,
    finalizeBulkSave,
    focusBaseTab,
    focusEntityTab,
    folderSaveRef,
    modelTabs,
    setActiveWorkTab,
    setSelectedFolderPath,
    startBulkSave,
    waitForBaseSaver,
    waitForFolderSaver,
    waitForSelection,
  ]);

  return {
    computeBaseSaveCount,
    saveActiveTab,
    saveAll,
  };
}
