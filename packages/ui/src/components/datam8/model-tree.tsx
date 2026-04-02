import React, { useMemo, useState } from "react";
import { Play } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "../ui/context-menu";

export type ModelTreeNode = {
  label: string;
  relPath?: string;
  type: "folder" | "entity";
  children?: ModelTreeNode[];
  path?: string;
};

export type ModelTreeProps = {
  tree: ModelTreeNode[];
  filter: string;
  onFilterChange: (value: string) => void;
  selectedRelPath?: string | null;
  selectedRelPaths?: Set<string>;
  selectedFolderPath?: string | null;
  selectableFolderPaths?: Set<string>;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelectEntity: (relPath: string, multi: boolean) => void;
  onSelectFolder?: (folderPath: string) => void;
  onCreateFolder?: (parentFolderPath: string) => void;
  onDeleteFolder?: (folderPath: string) => void;
  onMoveEntity: (fromRelPath: string, targetFolder: string) => void;
  onRequestMove?: (relPaths: string[]) => void;
  onDuplicate?: (relPath: string) => void;
  onDelete?: (relPath: string) => void;
  ensureExpanded: (path: string) => void;
  sidebarOpen?: boolean;
  showFilter?: boolean;
};

export function ModelTree({
  tree,
  filter,
  onFilterChange,
  selectedRelPath,
  selectedRelPaths,
  selectedFolderPath,
  selectableFolderPaths,
  expanded,
  onToggle,
  onSelectEntity,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onMoveEntity,
  onRequestMove,
  onDuplicate,
  onDelete,
  ensureExpanded,
  showFilter = true,
}: ModelTreeProps) {
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const filterLower = filter.trim().toLowerCase();

  const canDropOnNode = (node: ModelTreeNode) => !!node.path && node.type === "folder";

  const matchesFilter = (node: ModelTreeNode): boolean => {
    if (!filterLower) return true;
    if (node.label.toLowerCase().includes(filterLower)) return true;
    if (node.children) {
      return node.children.some(matchesFilter);
    }
    return false;
  };

  const clearDropState = (path?: string) => {
    setDropTargetPath((current) => (path && current !== path ? current : null));
  };

  const renderNodes = (nodes: ModelTreeNode[], depth = 0) => {
    const visibleNodes = nodes.filter(matchesFilter);

    return visibleNodes.map((node, index) => {
      const depthClass = `tree-depth-${Math.min(depth + 1, 6)}`;
      const isLast = index === visibleNodes.length - 1;
      const isRoot = depth === 0;
      const itemStyle = { "--tree-depth": depth + 1 } as React.CSSProperties;
      const itemClass = `tree__item ${depthClass} ${isRoot ? "tree__item--root" : ""} ${isLast ? "tree__item--last" : ""}`;

      if (node.type === "entity") {
        const isSelected = !!(
          node.relPath &&
          (selectedRelPaths?.has(node.relPath) || selectedRelPath === node.relPath)
        );
        return (
          <ContextMenu key={node.relPath || `entity-${depth}-${index}-${node.label}`}>
            <ContextMenuTrigger asChild>
              <div className={`${itemClass} tree__item--entity`} style={itemStyle}>
                <button
                  className={`tree__child tree__child--entity ${isSelected ? "tree__child--active" : ""}`}
                  onClick={(e) => {
                    if (node.relPath) {
                      onSelectEntity(node.relPath, e.metaKey || e.ctrlKey || e.shiftKey);
                    }
                  }}
                  onContextMenu={() => {
                    if (node.relPath && selectedRelPaths && !selectedRelPaths.has(node.relPath)) {
                      onSelectEntity(node.relPath, false);
                    } else if (node.relPath && !selectedRelPaths && selectedRelPath !== node.relPath) {
                      onSelectEntity(node.relPath, false);
                    }
                  }}
                  draggable
                  onDragStart={(e) => {
                    if (node.relPath) {
                      e.dataTransfer.setData("text/plain", node.relPath);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingPath(node.relPath);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingPath(null);
                    clearDropState();
                  }}
                  data-dragging={draggingPath === node.relPath ? "true" : "false"}
                >
                  {node.label}
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onClick={() => {
                  if (!node.relPath) return;
                  const targets =
                    selectedRelPaths && selectedRelPaths.has(node.relPath)
                      ? Array.from(selectedRelPaths)
                      : [node.relPath];
                  onRequestMove?.(targets);
                }}
              >
                Move to...
                <ContextMenuShortcut>Ctrl+M</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => node.relPath && onDuplicate?.(node.relPath)}>
                Duplicate
                <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => node.relPath && onDelete?.(node.relPath)}>
                Delete
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }

      const hasMatchingChildren = !!(filterLower && node.children?.some(matchesFilter));
      const isOpen = expanded.has(node.path || node.label) || hasMatchingChildren;
      const isFolderSelected = !!(node.path && selectedFolderPath === node.path);
      const isFolderSelectable = !!(
        node.path &&
        (!selectableFolderPaths || selectableFolderPaths.has(node.path))
      );
      return (
        <ContextMenu key={node.path || `folder-${depth}-${index}-${node.label}`}>
          <ContextMenuTrigger asChild>
            <div
              className={`${itemClass} tree__item--folder tree__node ${dropTargetPath === node.path ? "tree__node--drop tree__node--drop-inside" : ""}`}
              style={itemStyle}
              onDragOver={(e) => {
                if (canDropOnNode(node)) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTargetPath(node.path!);
                }
              }}
              onDrop={(e) => {
                if (!canDropOnNode(node)) return;
                e.preventDefault();
                const fromRelPath = e.dataTransfer.getData("text/plain");
                if (fromRelPath) onMoveEntity(fromRelPath, node.path!);
                ensureExpanded(node.path!);
                clearDropState();
                setDraggingPath(null);
                e.stopPropagation();
              }}
              onDragEnter={(e) => {
                if (canDropOnNode(node)) {
                  e.preventDefault();
                  setDropTargetPath(node.path!);
                }
              }}
              onDragLeave={(e) => {
                if (node.path && e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
                clearDropState(node.path);
              }}
            >
              <button
                className={`tree__node-label tree__node-toggle ${isFolderSelected ? "tree__child--active" : ""} ${isFolderSelectable ? "" : "tree__node-toggle--readonly"}`}
                onClick={() => {
                  if (!node.path) return;
                  onToggle(node.path);
                  if (isFolderSelectable) onSelectFolder?.(node.path);
                }}
              >
                <span
                  className={`chevron ${isOpen ? "chevron--open" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!node.path) return;
                    onToggle(node.path);
                  }}
                >
                  <Play className="chevron__icon" fill="currentColor" strokeWidth={1.8} />
                </span>
                {node.label}
              </button>
              {isOpen ? <div className="tree__children">{node.children ? renderNodes(node.children, depth + 1) : null}</div> : null}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem
              disabled={!node.path || !onCreateFolder}
              onClick={() => {
                if (!node.path) return;
                onCreateFolder?.(node.path);
              }}
            >
              New Folder...
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={!node.path || !onDeleteFolder || (node.path.split("/").filter(Boolean).length <= 1)}
              onClick={() => {
                if (!node.path) return;
                onDeleteFolder?.(node.path);
              }}
            >
              Delete Folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    });
  };

  const filteredTree = useMemo(() => tree.filter(matchesFilter), [tree, filterLower]);

  return (
    <div className="tree tree--model">
      {showFilter ? (
        <div className="sidebar__filter">
          <input placeholder="Filter model..." value={filter} onChange={(e) => onFilterChange(e.target.value)} />
        </div>
      ) : null}
      {filteredTree.length === 0 ? <div className="muted">No entities loaded</div> : renderNodes(filteredTree)}
    </div>
  );
}
