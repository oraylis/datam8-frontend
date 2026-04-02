import { useEffect, useMemo, useState } from "react";
import { Button, ModelTree, cn } from "@datam8/ui";
import { FolderOpen, MoonStar, PanelLeft, Plus, RefreshCw, Search, Sparkles, SunMedium } from "lucide-react";
import dm8Logo from "../../../assets/dm8_incl_text.png";
import type { BaseEntity, TreeNode } from "../model-types";

type SidebarProps = {
  tree: TreeNode[];
  onSelectEntity: (relPath: string, multi: boolean) => void;
  onSelectFolder?: (folderPath: string) => void;
  selectableFolderPaths?: Set<string>;
  onCreateFolder?: (parentFolderPath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onMoveEntity: (fromRelPath: string, targetFolder: string) => void;
  onRequestMove?: (relPaths: string[]) => void;
  onDuplicate?: (relPath: string) => void;
  onDelete?: (relPath: string) => void;
  ensureExpanded: (path: string) => void;
  selectedRelPath?: string | null;
  selectedRelPaths?: Set<string>;
  selectedFolderPath?: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  baseItems: (BaseEntity & { displayName?: string })[];
  onSelectBase: (relPath: string, title: string) => void;
  selectedBaseRelPath?: string | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onNew: () => void;
  onOpen: () => void;
  onReload: () => void;
  onAddEntity: () => void;
  onToggleTheme: () => void;
  resolvedTheme: "light" | "dark";
};

type SidebarScope = "model" | "base";

export function Sidebar({
  tree,
  onSelectEntity,
  onSelectFolder,
  selectableFolderPaths,
  onCreateFolder,
  onDeleteFolder,
  onMoveEntity,
  onRequestMove,
  onDuplicate,
  onDelete,
  ensureExpanded,
  selectedRelPath,
  selectedRelPaths,
  selectedFolderPath,
  expanded,
  onToggle,
  filter,
  onFilterChange,
  baseItems,
  onSelectBase,
  selectedBaseRelPath,
  sidebarOpen,
  onToggleSidebar,
  onResizeStart,
  onNew,
  onOpen,
  onReload,
  onAddEntity,
  onToggleTheme,
  resolvedTheme,
}: SidebarProps) {
  const [visibleScope, setVisibleScope] = useState<SidebarScope>(selectedBaseRelPath ? "base" : "model");
  const filterLower = filter.trim().toLowerCase();
  useEffect(() => {
    if (selectedBaseRelPath) setVisibleScope("base");
  }, [selectedBaseRelPath]);

  useEffect(() => {
    if (selectedRelPath || selectedFolderPath) setVisibleScope("model");
  }, [selectedFolderPath, selectedRelPath]);

  const filteredBase = useMemo(
    () => baseItems.filter((b) => !filterLower || (b.name || "").toLowerCase().includes(filterLower)),
    [baseItems, filterLower],
  );

  return (
    <div className={`sidebar ${sidebarOpen ? "" : "sidebar--collapsed"}`}>
      <div className="sidebar__fixed">
        <div className="sidebar__identity-row">
          {sidebarOpen ? (
            <div className="sidebar__brand" aria-label="DataM8">
              <img className="sidebar__brand-logo" src={dm8Logo} alt="DataM8" />
            </div>
          ) : null}
          <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}>
            <PanelLeft className={cn("sidebar-toggle__icon h-4 w-4")} strokeWidth={1.9} />
          </button>
        </div>

        <div className="sidebar__actions" aria-label="Primary actions">
          <Button variant="sidebar" onClick={onNew} title="New">
            <Sparkles className="h-4 w-4" />
            {sidebarOpen ? <span>New</span> : null}
          </Button>
          <Button variant="sidebar" onClick={onOpen} title="Open">
            <FolderOpen className="h-4 w-4" />
            {sidebarOpen ? <span>Open</span> : null}
          </Button>
          <Button variant="sidebar" onClick={onReload} title="Reload">
            <RefreshCw className="h-4 w-4" />
            {sidebarOpen ? <span>Reload</span> : null}
          </Button>
          <Button variant="sidebar" onClick={onAddEntity} title="Add Entity">
            <Plus className="h-4 w-4" />
            {sidebarOpen ? <span>Add Entity</span> : null}
          </Button>
        </div>

        {sidebarOpen ? (
          <>
            <div className="sidebar__filter">
              <span className={cn("sidebar__filter-placeholder", filter ? "sidebar__filter-placeholder--hidden" : "")} aria-hidden>
                <Search className="sidebar__filter-icon h-3.5 w-3.5" />
                <span>{visibleScope === "base" ? "Filter base..." : "Filter model..."}</span>
              </span>
              <input
                className="sidebar__filter-input"
                placeholder=""
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                aria-label={visibleScope === "base" ? "Filter base entities" : "Filter model entities"}
              />
            </div>
            <div className="sidebar__scope-switch" role="tablist" aria-label="Navigation scope">
              <button
                role="tab"
                aria-selected={visibleScope === "model"}
                className={cn("sidebar__scope-switch-btn", visibleScope === "model" ? "sidebar__scope-switch-btn--active" : "")}
                onClick={() => setVisibleScope("model")}
              >
                Model
              </button>
              <button
                role="tab"
                aria-selected={visibleScope === "base"}
                className={cn("sidebar__scope-switch-btn", visibleScope === "base" ? "sidebar__scope-switch-btn--active" : "")}
                onClick={() => setVisibleScope("base")}
              >
                Base
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="sidebar__scrollable">
        {sidebarOpen ? (
          visibleScope === "base" ? (
            <div className="sidebar__section">
              <div className="tree">
                {filteredBase.length === 0 ? (
                  <div className="muted">No base entities</div>
                ) : (
                  filteredBase.map((b) => (
                    <button
                      key={b.relPath}
                      className={cn("tree__child tree__child--entity", selectedBaseRelPath === b.relPath ? "tree__child--active" : "")}
                      onClick={() => onSelectBase(b.relPath, b.displayName || b.name)}
                    >
                      {b.displayName || b.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="sidebar__section">
              <ModelTree
                tree={tree}
                filter={filter}
                onFilterChange={onFilterChange}
                selectedRelPath={selectedRelPath}
                selectedRelPaths={selectedRelPaths}
                selectedFolderPath={selectedFolderPath}
                selectableFolderPaths={selectableFolderPaths}
                expanded={expanded}
                onToggle={onToggle}
                onSelectEntity={onSelectEntity}
                onSelectFolder={onSelectFolder}
                onCreateFolder={onCreateFolder}
                onDeleteFolder={onDeleteFolder}
                onMoveEntity={onMoveEntity}
                onRequestMove={onRequestMove}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                ensureExpanded={ensureExpanded}
                sidebarOpen={sidebarOpen}
                showFilter={false}
              />
            </div>
          )
        ) : null}
      </div>

      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__theme-toggle"
          onClick={onToggleTheme}
          aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {resolvedTheme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
        </button>
      </div>

      {onResizeStart ? <div className="sidebar__resizer" onMouseDown={(e) => onResizeStart(e)} /> : null}
    </div>
  );
}
