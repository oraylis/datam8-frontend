import { useMemo, useState } from "react";
import { Button, Input, ScrollArea, cn } from "@datam8/ui";

export type FolderHierarchyItem = { value: string; label: string };

const normalizeFolderPath = (path: string) =>
  (path || "").split(/[\\/]/).join("/").replace(/^\/+|\/+$/g, "");

const parentFolderPath = (path: string) => {
  const parts = normalizeFolderPath(path).split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
};

const withAncestors = (paths: string[]) => {
  const out = new Set<string>();
  paths.forEach((raw) => {
    const normalized = normalizeFolderPath(raw);
    if (!normalized) return;
    const parts = normalized.split("/");
    for (let i = 1; i <= parts.length; i += 1) {
      out.add(parts.slice(0, i).join("/"));
    }
  });
  return Array.from(out).sort((a, b) => a.localeCompare(b));
};

const buildFolderNameMap = (folderItems: FolderHierarchyItem[]) => {
  const map = new Map<string, string>();
  folderItems.forEach((item) => {
    const path = normalizeFolderPath(item.value || "");
    if (!path) return;
    const label = (item.label || "").trim();
    if (label) map.set(path, label);
  });
  withAncestors(folderItems.map((item) => item.value)).forEach((path) => {
    if (!map.has(path)) {
      map.set(path, path.split("/").filter(Boolean).pop() || path);
    }
  });
  return map;
};

type FolderHierarchyPickerProps = {
  value: string;
  onChange: (value: string) => void;
  folderItems: FolderHierarchyItem[];
  disabled?: boolean;
  panelClassName?: string;
  scrollClassName?: string;
};

export const FolderHierarchyPicker = ({
  value,
  onChange,
  folderItems,
  disabled,
  panelClassName,
  scrollClassName,
}: FolderHierarchyPickerProps) => {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  const allPaths = useMemo(() => withAncestors(folderItems.map((item) => item.value)), [folderItems]);
  const folderNameMap = useMemo(() => buildFolderNameMap(folderItems), [folderItems]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    allPaths.forEach((path) => {
      const parent = parentFolderPath(path);
      const current = map.get(parent) || [];
      current.push(path);
      map.set(parent, current);
    });
    map.forEach((list, key) =>
      map.set(
        key,
        list.sort((a, b) => (folderNameMap.get(a) || a).localeCompare(folderNameMap.get(b) || b)),
      ),
    );
    return map;
  }, [allPaths, folderNameMap]);

  const childPaths = useMemo(() => childrenByParent.get(currentPath) || [], [childrenByParent, currentPath]);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const crumbs: { label: string; value: string }[] = [{ label: "Model", value: "" }];
    parts.forEach((part, idx) => {
      const crumbPath = parts.slice(0, idx + 1).join("/");
      crumbs.push({ label: folderNameMap.get(crumbPath) || part, value: crumbPath });
    });
    return crumbs;
  }, [currentPath, folderNameMap]);

  const openPicker = () => {
    const normalized = normalizeFolderPath(value || "");
    setCurrentPath(parentFolderPath(normalized));
    setOpen(true);
  };

  const isSelectable = (path: string) => normalizeFolderPath(path).split("/").filter(Boolean).length > 1;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={value || ""} readOnly placeholder="No folder selected" disabled={disabled} />
        <Button type="button" variant="outline" onClick={openPicker} disabled={disabled}>
          Browse
        </Button>
      </div>
      {open ? (
        <div className={cn("codex-popup-section space-y-3 p-3", panelClassName)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {breadcrumbs.map((crumb, idx) => (
                <button
                  type="button"
                  key={`${crumb.value}-${idx}`}
                  className="rounded px-1 hover:text-foreground"
                  onClick={() => setCurrentPath(crumb.value)}
                >
                  {idx > 0 ? ` / ${crumb.label}` : crumb.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
          <ScrollArea className={cn("codex-popup-scroll h-48", scrollClassName)}>
            <div className="divide-y divide-border/60">
              {childPaths.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No subfolders</div>
              ) : (
                childPaths.map((path) => {
                  const name = folderNameMap.get(path) || path.split("/").filter(Boolean).pop() || path;
                  const selectable = isSelectable(path);
                  const hasChildren = (childrenByParent.get(path) || []).length > 0;
                  return (
                    <div key={path} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        className="text-left text-sm flex-1 hover:text-foreground"
                        onClick={() => setCurrentPath(path)}
                      >
                        {name}
                        {hasChildren ? " /" : ""}
                      </button>
                      <Button
                        type="button"
                        variant={value === path ? "default" : "outline"}
                        size="sm"
                        disabled={!selectable}
                        onClick={() => {
                          onChange(path);
                          setOpen(false);
                        }}
                      >
                        Select
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">
            Selected: <span className="text-foreground">{value || "None"}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
};
