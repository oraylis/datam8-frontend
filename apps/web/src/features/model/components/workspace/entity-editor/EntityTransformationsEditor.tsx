import type React from "react";
import { useState } from "react";
import { FormSelect, Textarea } from "@datam8/ui";
import { ChevronDown, GripVertical, Trash2 } from "lucide-react";
import type { ModelEntity } from "../../../model-types";
import { IconBtn } from "../common/IconBtn";
import { reindexRecordAfterRemove } from "../hooks/transformationSourceMaps";
import { deleteFunctionSource, readFunctionSource, renameFunctionSource } from "../../../../../shared/desktop/functionSourceBridge";

const derivePyFilename = (stepName: string): string => {
  const trimmed = (stepName || "").trim();
  const safe = trimmed ? trimmed.replace(/[\\/]/g, "_") : "";
  return `${safe || "function"}.py`;
};

export const derivePySourcePath = (stepName: string, prevSource?: string): string => {
  const filename = derivePyFilename(stepName);
  const prev = (prevSource || "").trim();
  if (!prev || !prev.includes("/")) return filename;
  const parts = prev.split("/").filter(Boolean);
  if (parts.length < 2) return filename;
  if (parts.some((p) => p === "." || p === "..")) return filename;
  const dir = parts.slice(0, -1).join("/");
  return `${dir}/${filename}`;
};

export const shouldDeleteFunctionSourceOnStepRemove = (
  transformations: any[],
  removeIndex: number,
  source: string,
): boolean => {
  const normalized = (source || "").trim();
  if (!normalized) return false;
  return !(transformations || []).some(
    (item, idx) =>
      idx !== removeIndex &&
      item?.kind === "function" &&
      typeof item?.function?.source === "string" &&
      item.function.source.trim() === normalized,
  );
};

type EntityTransformationsEditorProps = {
  transformations: any[];
  transformKinds: string[];
  openTransformSources: Record<number, boolean>;
  transformSourceCache: Record<number, string>;
  transformSourceDirty: Record<number, boolean>;
  dragTransformIndex: React.MutableRefObject<number | null>;
  normalizeTransformations: (list: any[]) => any[];
  updateTransformation: (idx: number, updater: (t: any) => any) => void;
  reorderTransformations: (from: number, to: number) => void;
  setTransformations: React.Dispatch<React.SetStateAction<any[]>>;
  setOpenTransformSources: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setTransformSourceCache: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setTransformSourceDirty: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  markEntityDirty: () => void;
  selectedEntity: ModelEntity | null;
  entityName: string;
  solutionPath: string;
  onCommit?: (reason: "dropdown-change" | "add-item" | "delete-item") => void;
  onDeleteTransformation?: () => void;
};

export const EntityTransformationsEditor = ({
  transformations,
  transformKinds,
  openTransformSources,
  transformSourceCache,
  transformSourceDirty,
  dragTransformIndex,
  normalizeTransformations,
  updateTransformation,
  reorderTransformations,
  setTransformations,
  setOpenTransformSources,
  setTransformSourceCache,
  setTransformSourceDirty,
  setSaveError,
  markEntityDirty,
  selectedEntity,
  entityName,
  solutionPath,
  onCommit,
  onDeleteTransformation,
}: EntityTransformationsEditorProps) => {
  const [dragOverState, setDragOverState] = useState<{ index: number; position: "before" | "after" } | null>(null);

  const handleFunctionRename = async (index: number) => {
    const tr = transformations[index];
    const prevSource = tr?.__uiPrevFunctionSource;
    const currentSource = tr?.function?.source;
    if (!tr || tr.kind !== "function" || !prevSource || !currentSource || prevSource === currentSource) return;
    if (!selectedEntity?.relPath) return;
    try {
      await renameFunctionSource({
        relPath: selectedEntity.relPath,
        fromSource: prevSource,
        toSource: currentSource,
        entityName: entityName || undefined,
        solutionPath: solutionPath || undefined,
      });
      updateTransformation(index, (t: any) => ({ ...t, __uiPrevFunctionSource: currentSource }));
    } catch (err) {
      const message = (err as Error).message || "Failed to rename function source.";
      console.error("[DataM8] Function source rename failed:", err);
      setSaveError(message);
      setTransformations((list) =>
        normalizeTransformations(
          list.map((t, i) =>
            i === index
              ? {
                  ...t,
                  function: { ...(t.function || {}), source: prevSource },
                  __uiPrevFunctionSource: prevSource,
                }
              : t,
          ),
        ),
      );
    }
  };
  return (
    <div>
        <div className="table entity-transformations-table">
          <div className="table-row table-head" style={{ gridTemplateColumns: "0.4fr 1.6fr 1fr 0.6fr" }}>
            <div></div>
            <div>Name</div>
            <div>Kind</div>
            <div>Actions</div>
          </div>
          {transformations.map((tr, idx) => {
            const mapKey = `tr-${idx}`;
            const dropClass =
              dragOverState?.index === idx
                ? dragOverState.position === "before"
                  ? "row--drop-before"
                  : "row--drop-after"
                : "";
            const handleDrop = (position: "before" | "after") => {
              const from = dragTransformIndex.current;
              if (from === null) return;
              const baseTarget = position === "before" ? idx : idx + 1;
              const target = from < baseTarget ? baseTarget - 1 : baseTarget;
              reorderTransformations(from, target);
              onCommit?.("add-item");
              dragTransformIndex.current = null;
              setDragOverState(null);
            };
            return (
              <div
                key={mapKey}
                className={`value-row ${openTransformSources[idx] ? "value-row--active" : ""} ${dropClass}`}
                onDragOver={(e) => {
                  if (dragTransformIndex.current === null) return;
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
                  setDragOverState({ index: idx, position });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(dragOverState?.position || "before");
                }}
                onDragLeave={() => {
                  setDragOverState((prev) => (prev?.index === idx ? null : prev));
                }}
              >
                <div className="table-row" style={{ gridTemplateColumns: "0.4fr 1.6fr 1fr 0.6fr" }}>
                  <div>
                    <IconBtn
                      title="Drag to reorder"
                      style={{ cursor: "grab", width: "100%" }}
                      draggable
                      onDragStart={(e) => {
                        dragTransformIndex.current = idx;
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(idx));
                      }}
                      onDragEnd={() => {
                        dragTransformIndex.current = null;
                        setDragOverState(null);
                      }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </IconBtn>
                  </div>
                <div>
                  <input
                    value={tr.name || ""}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      updateTransformation(idx, (t: any) => {
                        const next: any = { ...t, name: nextName };
                        if (t.kind === "function") {
                          const source = derivePySourcePath(nextName, t.function?.source);
                          next.function = { ...(t.function || {}), source };
                        }
                        return next;
                      });
                    }}
                    onBlur={() => {
                      if (tr.kind === "function") {
                        void handleFunctionRename(idx);
                      }
                    }}
                  />
                </div>
                <div>
                  <FormSelect
                    value={tr.kind || ""}
                    onChange={(kind) => {
                      updateTransformation(idx, (t: any) => ({
                        ...t,
                        kind,
                        function:
                          kind === "function"
                            ? { ...(t.function || {}), source: derivePySourcePath(t.name || "", t.function?.source) }
                            : undefined,
                        __uiPrevFunctionSource:
                          kind === "function"
                            ? t.__uiPrevFunctionSource || t.function?.source || derivePySourcePath(t.name || "", t.function?.source)
                            : undefined,
                      }));
                      onCommit?.("dropdown-change");
                    }}
                    options={[{ value: "", label: "Select kind" }, ...transformKinds.map((k) => ({ value: k, label: k }))]}
                    placeholder="Select kind"
                  />
                </div>
                <div className="actions actions--tight">
                  {tr.kind === "function" ? (
                    <IconBtn
                      active={!!openTransformSources[idx]}
                      title="Toggle code"
                      onClick={async () => {
                        if (!openTransformSources[idx] && tr.function?.source && !transformSourceCache[idx]) {
                          try {
                            const content = await readFunctionSource({
                              relPath: selectedEntity?.relPath || "",
                              source: tr.function.source,
                              entityName: entityName || "",
                              solutionPath: solutionPath || undefined,
                            });
                            setTransformSourceCache((prev) => ({ ...prev, [idx]: content || "" }));
                          } catch (err) {
                            console.error("[DataM8] Failed to load function source:", err);
                            setSaveError((err as Error).message || "Failed to load function source.");
                          }
                        }
                        setOpenTransformSources((prev) => ({ ...prev, [idx]: !prev[idx] }));
                      }}
                    >
                      <ChevronDown
                        className={`h-4 w-4 chevron-toggle ${openTransformSources[idx] ? "chevron-toggle--open" : ""}`}
                      />
                    </IconBtn>
                  ) : null}
                  <IconBtn
                    title="Remove"
                    onClick={async () => {
                      const removed = transformations[idx];
                      const removedSource =
                        removed?.kind === "function" && typeof removed?.function?.source === "string"
                          ? removed.function.source.trim()
                          : "";
                      const shouldDeleteSource =
                        !!selectedEntity?.relPath &&
                        !!removedSource &&
                        shouldDeleteFunctionSourceOnStepRemove(transformations, idx, removedSource);

                      markEntityDirty();
                      setTransformations((list) => normalizeTransformations(list.filter((_, i) => i !== idx)));
                      setOpenTransformSources((prev) => reindexRecordAfterRemove(prev, idx));
                      setTransformSourceCache((prev) => reindexRecordAfterRemove(prev, idx));
                      setTransformSourceDirty((prev) => reindexRecordAfterRemove(prev, idx));
                      onDeleteTransformation?.();

                      if (shouldDeleteSource) {
                        try {
                          await deleteFunctionSource({
                            relPath: selectedEntity!.relPath,
                            source: removedSource,
                            solutionPath: solutionPath || undefined,
                          });
                        } catch (err) {
                          console.error("[DataM8] Function source delete failed:", err);
                          setSaveError((err as Error).message || "Failed to delete function source.");
                        }
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconBtn>
                </div>
              </div>
              {tr.kind === "function" && openTransformSources[idx] ? (
                <div className="source-block">
                  <div className="muted small">Function Source ({tr.function?.source || `${tr.name || "function"}.py`})</div>
                  <Textarea
                    className="code"
                    rows={10}
                    value={transformSourceCache[idx] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTransformSourceCache((prev) => ({ ...prev, [idx]: val }));
                      setTransformSourceDirty((prev) => ({ ...prev, [idx]: true }));
                      updateTransformation(idx, (t: any) => ({
                        ...t,
                        function: { ...(t.function || {}), source: t.function?.source || derivePyFilename(t.name || "") },
                      }));
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};


