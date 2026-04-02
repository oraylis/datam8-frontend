import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { BaseEntity, BaseTab, FolderEntity, ModelEntity, ModelTab, Tab } from "./model-types";

type ModelEditorContextValue = {
  modelEntities: ModelEntity[];
  baseEntities: BaseEntity[];
  folderEntities: FolderEntity[];
  setModelEntities: React.Dispatch<React.SetStateAction<ModelEntity[]>>;
  setBaseEntities: React.Dispatch<React.SetStateAction<BaseEntity[]>>;
  setFolderEntities: React.Dispatch<React.SetStateAction<FolderEntity[]>>;
  tabs: Tab[];
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  treeFilter: string;
  setTreeFilter: React.Dispatch<React.SetStateAction<string>>;
  modelTabs: ModelTab[];
  baseTabs: BaseTab[];
  setModelTabs: React.Dispatch<React.SetStateAction<ModelTab[]>>;
  setBaseTabs: React.Dispatch<React.SetStateAction<BaseTab[]>>;
  activeWorkTab: string | null;
  setActiveWorkTab: React.Dispatch<React.SetStateAction<string | null>>;
  collapsedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  selectedRelPath: string | null;
  setSelectedRelPath: (value: string | null) => void;
  selectedFolderPath: string | null;
  setSelectedFolderPath: (value: string | null) => void;
  selectedRelPaths: Set<string>;
  setSelectedRelPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleEntitySelection: (relPath: string, multi: boolean) => void;
  getSelectedModelEntityIds: () => string[];
  selectedBaseRelPath: string | null;
  setSelectedBaseRelPath: (value: string | null) => void;
  selectedEntity: ModelEntity | null;
  selectedBase: BaseEntity | null;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  openModelTab: (relPath: string, title: string) => void;
  openBaseTab: (relPath: string, title: string) => void;
  focusEntityTab: (relPath: string) => void;
  focusBaseTab: (relPath: string) => void;
  closeTab: (kind: "entity" | "base", relPath: string) => void;
  closeAllTabs: () => void;
  clearActiveSelection: () => void;
  setTabDirty: (relPath: string, kind: "entity" | "base", dirty: boolean) => void;
  getEntityDraft: (relPath: string) => any | null;
  setEntityDraft: (relPath: string, draft: any | null) => void;
  getBaseDraft: (relPath: string) => any | null;
  setBaseDraft: (relPath: string, draft: any | null) => void;
  clearAllDrafts: () => void;
  anyDirty: boolean;
};

const ModelEditorContext = createContext<ModelEditorContextValue | undefined>(undefined);

export function ModelEditorProvider({ children }: { children: React.ReactNode }) {
  const [modelEntities, setModelEntities] = useState<ModelEntity[]>([]);
  const [baseEntities, setBaseEntities] = useState<BaseEntity[]>([]);
  const [folderEntities, setFolderEntities] = useState<FolderEntity[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(320);
  const [tabs] = useState<Tab[]>([
    { id: "entity", title: "Entities", kind: "entity" },
    { id: "base", title: "Base", kind: "base" },
  ]);
  const [activeTab, setActiveTab] = useState("entity");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [treeFilter, setTreeFilter] = useState("");
  const [modelTabs, setModelTabs] = useState<ModelTab[]>([]);
  const [baseTabs, setBaseTabs] = useState<BaseTab[]>([]);
  const [activeWorkTab, setActiveWorkTab] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedRelPaths, setSelectedRelPaths] = useState<Set<string>>(new Set());
  const [selectedRelPath, setSelectedRelPath] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [selectedBaseRelPath, setSelectedBaseRelPath] = useState<string | null>(null);
  const [entityDraftsByRelPath, setEntityDraftsByRelPath] = useState<Record<string, any>>({});
  const [baseDraftsByRelPath, setBaseDraftsByRelPath] = useState<Record<string, any>>({});
  const entityDraftsRef = useRef<Record<string, any>>(entityDraftsByRelPath);
  const baseDraftsRef = useRef<Record<string, any>>(baseDraftsByRelPath);

  useEffect(() => {
    entityDraftsRef.current = entityDraftsByRelPath;
  }, [entityDraftsByRelPath]);

  useEffect(() => {
    baseDraftsRef.current = baseDraftsByRelPath;
  }, [baseDraftsByRelPath]);

  const toggleEntitySelection = useCallback((relPath: string, multi: boolean) => {
    if (multi) {
      setSelectedRelPaths((prev) => {
        const next = new Set(prev);
        if (next.has(relPath)) next.delete(relPath);
        else next.add(relPath);
        return next;
      });
      // If adding to selection, make it the primary one. If removing, keep current or null?
      // For now, always set as primary if clicked.
      setSelectedRelPath(relPath);
      setSelectedFolderPath(null);
    } else {
      setSelectedRelPaths(new Set([relPath]));
      setSelectedRelPath(relPath);
      setSelectedFolderPath(null);
    }
  }, []);

  const getSelectedModelEntityIds = useCallback(() => {
     return modelEntities
       .filter((m) => selectedRelPaths.has(m.relPath))
       .map((m) => m.locator); 
  }, [modelEntities, selectedRelPaths]);

  const selectedEntity = useMemo(() => {
    const relPath =
      activeWorkTab && activeWorkTab.startsWith("entity:") ? activeWorkTab.replace("entity:", "") : selectedRelPath;
    return modelEntities.find((m) => m.relPath === relPath) || null;
  }, [activeWorkTab, modelEntities, selectedRelPath]);

  const selectedBase = useMemo(() => {
    const relPath = activeWorkTab && activeWorkTab.startsWith("base:") ? activeWorkTab.replace("base:", "") : selectedBaseRelPath;
    return baseEntities.find((b) => b.relPath === relPath) || null;
  }, [activeWorkTab, baseEntities, selectedBaseRelPath]);

  const focusEntityTab = useCallback((relPath: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(Array.from(prev));
      next.delete("model");
      const zone = (relPath.split("/")[1] || "").trim();
      if (zone) next.delete(`model:${zone}`);
      return next;
    });
    setActiveTab("entity");
    setActiveWorkTab(`entity:${relPath}`);
    setSelectedRelPath(relPath);
    setSelectedRelPaths(new Set([relPath]));
    setSelectedBaseRelPath(null);
    setSelectedFolderPath(null);
  }, []);

  const focusBaseTab = useCallback((relPath: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(Array.from(prev));
      next.delete("base");
      return next;
    });
    setActiveTab("base");
    setActiveWorkTab(`base:${relPath}`);
    setSelectedBaseRelPath(relPath);
    setSelectedRelPath(null);
    setSelectedRelPaths(new Set());
    setSelectedFolderPath(null);
  }, []);

  const clearActiveSelection = useCallback(() => {
    setActiveWorkTab(null);
    setSelectedRelPath(null);
    setSelectedRelPaths(new Set());
    setSelectedBaseRelPath(null);
    setSelectedFolderPath(null);
    setActiveTab("entity");
  }, []);

  const openModelTab = useCallback(
    (relPath: string, title: string) => {
      setModelTabs((tabs) => {
        if (tabs.find((t) => t.relPath === relPath)) return tabs;
        return [...tabs, { relPath, title, dirty: false }];
      });
      focusEntityTab(relPath);
    },
    [focusEntityTab],
  );

  const openBaseTab = useCallback(
    (relPath: string, title: string) => {
      setBaseTabs((tabs) => {
        if (tabs.find((t) => t.relPath === relPath)) return tabs;
        return [...tabs, { relPath, title, dirty: false }];
      });
      focusBaseTab(relPath);
    },
    [focusBaseTab],
  );

  const setTabDirty = useCallback((relPath: string, kind: "entity" | "base", dirty: boolean) => {
    if (kind === "entity") {
      setModelTabs((tabs) => {
        let changed = false;
        const next = tabs.map((t) => {
          if (t.relPath !== relPath) return t;
          if (t.dirty === dirty) return t;
          changed = true;
          return { ...t, dirty };
        });
        return changed ? next : tabs;
      });
    } else {
      setBaseTabs((tabs) => {
        let changed = false;
        const next = tabs.map((t) => {
          if (t.relPath !== relPath) return t;
          if (t.dirty === dirty) return t;
          changed = true;
          return { ...t, dirty };
        });
        return changed ? next : tabs;
      });
    }
  }, []);

  const setEntityDraft = useCallback((relPath: string, draft: any | null) => {
    if (!relPath) return;
    const current = entityDraftsRef.current;
    if (draft === null) {
      if (!Object.prototype.hasOwnProperty.call(current, relPath)) return;
      const next = { ...current };
      delete next[relPath];
      entityDraftsRef.current = next;
      setEntityDraftsByRelPath(next);
      return;
    }
    if (current[relPath] === draft) return;
    const next = { ...current, [relPath]: draft };
    entityDraftsRef.current = next;
    setEntityDraftsByRelPath(next);
  }, []);

  const getEntityDraft = useCallback((relPath: string) => {
    return entityDraftsRef.current[relPath] ?? null;
  }, []);

  const setBaseDraft = useCallback((relPath: string, draft: any | null) => {
    if (!relPath) return;
    const current = baseDraftsRef.current;
    if (draft === null) {
      if (!Object.prototype.hasOwnProperty.call(current, relPath)) return;
      const next = { ...current };
      delete next[relPath];
      baseDraftsRef.current = next;
      setBaseDraftsByRelPath(next);
      return;
    }
    if (current[relPath] === draft) return;
    const next = { ...current, [relPath]: draft };
    baseDraftsRef.current = next;
    setBaseDraftsByRelPath(next);
  }, []);

  const getBaseDraft = useCallback((relPath: string) => {
    return baseDraftsRef.current[relPath] ?? null;
  }, []);

  const clearAllDrafts = useCallback(() => {
    entityDraftsRef.current = {};
    baseDraftsRef.current = {};
    setEntityDraftsByRelPath((prev) => (Object.keys(prev).length ? {} : prev));
    setBaseDraftsByRelPath((prev) => (Object.keys(prev).length ? {} : prev));
  }, []);

  const closeTab = useCallback(
    (kind: "entity" | "base", relPath: string) => {
      setModelTabs((tabs) => (kind === "entity" ? tabs.filter((t) => t.relPath !== relPath) : tabs));
      setBaseTabs((tabs) => (kind === "base" ? tabs.filter((t) => t.relPath !== relPath) : tabs));
      if (kind === "entity") {
        setEntityDraft(relPath, null);
      } else {
        setBaseDraft(relPath, null);
      }

      if (kind === "entity" && selectedRelPath === relPath) {
        setSelectedRelPath(null);
      }
      if (kind === "base" && selectedBaseRelPath === relPath) {
        setSelectedBaseRelPath(null);
      }

      setActiveWorkTab((current) => {
        const isActive = current === `${kind}:${relPath}`;
        if (!isActive) return current;
        const nextModelTabs = kind === "entity" ? modelTabs.filter((t) => t.relPath !== relPath) : modelTabs;
        const nextBaseTabs = kind === "base" ? baseTabs.filter((t) => t.relPath !== relPath) : baseTabs;
        const fallback =
          nextModelTabs.length > 0
            ? { kind: "entity" as const, relPath: nextModelTabs[nextModelTabs.length - 1].relPath }
            : nextBaseTabs.length > 0
              ? { kind: "base" as const, relPath: nextBaseTabs[nextBaseTabs.length - 1].relPath }
              : null;
        if (fallback) {
          if (fallback.kind === "entity") {
            focusEntityTab(fallback.relPath);
          } else {
            focusBaseTab(fallback.relPath);
          }
          return `${fallback.kind}:${fallback.relPath}`;
        }
        clearActiveSelection();
        return null;
      });
    },
    [baseTabs, clearActiveSelection, focusBaseTab, focusEntityTab, modelTabs, selectedBaseRelPath, selectedRelPath, setBaseDraft, setEntityDraft],
  );

  const closeAllTabs = useCallback(() => {
    setModelTabs([]);
    setBaseTabs([]);
    entityDraftsRef.current = {};
    baseDraftsRef.current = {};
    setEntityDraftsByRelPath({});
    setBaseDraftsByRelPath({});
    clearActiveSelection();
  }, [clearActiveSelection]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const anyDirty = useMemo(() => modelTabs.some((t) => t.dirty) || baseTabs.some((t) => t.dirty), [baseTabs, modelTabs]);

  return (
    <ModelEditorContext.Provider
      value={{
        modelEntities,
        baseEntities,
        folderEntities,
        setModelEntities,
        setBaseEntities,
        setFolderEntities,
        tabs,
        activeTab,
        setActiveTab,
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
        selectedRelPaths,
        setSelectedRelPaths,
        toggleEntitySelection,
        getSelectedModelEntityIds,
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
        clearActiveSelection,
        setTabDirty,
        getEntityDraft,
        setEntityDraft,
        getBaseDraft,
        setBaseDraft,
        clearAllDrafts,
        anyDirty,
      }}
    >
      {children}
    </ModelEditorContext.Provider>
  );
}

export function useModelEditor() {
  const ctx = useContext(ModelEditorContext);
  if (!ctx) {
    throw new Error("useModelEditor must be used within ModelEditorProvider");
  }
  return ctx;
}
