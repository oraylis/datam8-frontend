import type React from "react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormSelect } from "@datam8/ui";
import type { ModelEntity } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";

export type EntityRelationshipsEditorHandle = {
  addRelationship: () => void;
};

type EntityRelationshipsEditorProps = {
  relationships: any[];
  setRelationships: React.Dispatch<React.SetStateAction<any[]>>;
  relationshipZones: Record<number, string>;
  setRelationshipZones: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  modelEntities: ModelEntity[];
  zones: string[];
  attributes: any[];
  resolveEntityNameById: (id: any) => any;
  zoneFromRelPath: (relPath: string | undefined) => string;
  onJumpToEntity: (relPath: string) => void;
  markEntityDirty: () => void;
  onRelationshipChange?: () => void;
  onDeleteRelationship?: () => void;
};

type RelationshipDialogState = {
  index: number | null;
  zone: string;
  targetModelEntityId: number | null;
  mappings: Array<{ source: string; target: string }>;
};

const getEntityZone = (entity: ModelEntity, zoneFromRelPath: (relPath: string | undefined) => string) =>
  zoneFromRelPath(entity.relPath);

export const EntityRelationshipsEditor = forwardRef<EntityRelationshipsEditorHandle, EntityRelationshipsEditorProps>(function EntityRelationshipsEditor({
  relationships,
  setRelationships,
  relationshipZones,
  setRelationshipZones,
  modelEntities,
  zones,
  attributes,
  resolveEntityNameById,
  zoneFromRelPath,
  onJumpToEntity,
  markEntityDirty,
  onRelationshipChange,
  onDeleteRelationship,
}: EntityRelationshipsEditorProps, ref) {
  const [mappingsCollapsed, setMappingsCollapsed] = useState<Record<number, boolean>>({});
  const [relationshipDialog, setRelationshipDialog] = useState<RelationshipDialogState | null>(null);

  const sourceColumns = useMemo(() => (attributes || []).map((a: any) => a.name).filter(Boolean), [attributes]);

  const openRelationshipDialog = useCallback((idx: number | null) => {
    if (idx === null) {
      setRelationshipDialog({
        index: null,
        zone: "",
        targetModelEntityId: null,
        mappings: [],
      });
      return;
    }
    const rel = relationships[idx];
    const currentTarget = modelEntities.find((ent) => ent.content?.id === rel?.targetModelEntityId);
    const zone = currentTarget ? getEntityZone(currentTarget, zoneFromRelPath) : relationshipZones[idx] || "";
    setRelationshipDialog({
      index: idx,
      zone,
      targetModelEntityId: rel?.targetModelEntityId ?? null,
      mappings: (rel?.mappings || []).map((mapping: any) => ({
        source: mapping?.source || "",
        target: mapping?.target || "",
      })),
    });
  }, [modelEntities, relationshipZones, relationships, zoneFromRelPath]);

  useImperativeHandle(ref, () => ({ addRelationship: () => openRelationshipDialog(null) }), [openRelationshipDialog]);

  const removeRelationship = (idx: number) => {
    markEntityDirty();
    setRelationships((list) => list.filter((_, i) => i !== idx));
    setRelationshipZones((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const keyNum = Number(key);
        if (Number.isNaN(keyNum)) return;
        if (keyNum < idx) {
          next[keyNum] = value;
        } else if (keyNum > idx) {
          next[keyNum - 1] = value;
        }
      });
      return next;
    });
    setMappingsCollapsed((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const keyNum = Number(key);
        if (Number.isNaN(keyNum)) return;
        if (keyNum < idx) {
          next[keyNum] = value;
        } else if (keyNum > idx) {
          next[keyNum - 1] = value;
        }
      });
      return next;
    });
    onDeleteRelationship?.();
  };

  const dialogTargetCandidates = relationshipDialog
    ? modelEntities.filter((ent) => getEntityZone(ent, zoneFromRelPath) === relationshipDialog.zone)
    : [];
  const dialogTargetEntity = relationshipDialog
    ? dialogTargetCandidates.find((ent) => ent.content?.id === relationshipDialog.targetModelEntityId)
    : null;
  const dialogTargetColumns = (dialogTargetEntity?.content?.attributes || [])
    .map((a: any) => (typeof a?.name === "string" ? a.name : ""))
    .filter((name: string) => name.trim().length > 0);
  const canSaveDialog =
    !!relationshipDialog?.zone &&
    relationshipDialog.targetModelEntityId !== null &&
    relationshipDialog.mappings.some((mapping) => mapping.source.trim() && mapping.target.trim());

  const saveRelationshipDialog = () => {
    if (!relationshipDialog || !canSaveDialog) return;
    const nextRel = {
      targetModelEntityId: relationshipDialog.targetModelEntityId,
      mappings: relationshipDialog.mappings
        .map((mapping) => ({ source: mapping.source.trim(), target: mapping.target.trim() }))
        .filter((mapping) => mapping.source && mapping.target),
    };
    markEntityDirty();
    if (relationshipDialog.index === null) {
      setRelationships((list) => [...list, { ...nextRel, name: `Rel${list.length + 1}` }]);
    } else {
      setRelationships((list) => list.map((rel, idx) => (idx === relationshipDialog.index ? { ...rel, ...nextRel } : rel)));
      setRelationshipZones((prev) => ({ ...prev, [relationshipDialog.index as number]: relationshipDialog.zone }));
    }
    onRelationshipChange?.();
    setRelationshipDialog(null);
  };

  return (
    <div>
      {relationships.map((rel, idx) => {
        const mappings = rel.mappings || [];
        const isCollapsed = mappingsCollapsed[idx] ?? true;
        const currentTarget = modelEntities.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const inferredZone = currentTarget ? zoneFromRelPath(currentTarget.relPath) : "";
        const selectedZone = relationshipZones[idx] || inferredZone || "";
        const targetCandidates = modelEntities.filter((ent) => zoneFromRelPath(ent.relPath) === selectedZone);
        const targetEntity = targetCandidates.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const targetColumns = (targetEntity?.content?.attributes || []).map((a: any) => a.name).filter(Boolean) || [];

        const targetName = rel.targetModelEntityId ? resolveEntityNameById(rel.targetModelEntityId) : "";
        const eyebrowText = `Zone: ${selectedZone || "Select zone"}${targetName ? ` - Target: ${targetName}` : ""}`;
        const titleText = targetName || rel.name || `Relationship ${idx + 1}`;

        const toggleCollapsed = () => setMappingsCollapsed((prev) => ({ ...prev, [idx]: !isCollapsed }));
        const addMapping = () => {
          if (!sourceColumns.length || !targetColumns.length) return;
          const newSource = sourceColumns[0];
          const newTarget = targetColumns[0];
          markEntityDirty();
          setRelationships((list) =>
            list.map((r, i) => (i === idx ? { ...r, mappings: [...(r.mappings || []), { source: newSource, target: newTarget }] } : r)),
          );
          setMappingsCollapsed((prev) => ({ ...prev, [idx]: false }));
          onRelationshipChange?.();
        };

        return (
          <div className="source-block" key={idx}>
            <div className="section-header" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="source-eyebrow" title={eyebrowText}>
                  {eyebrowText}
                </div>
                <div className="section-title source-title">{titleText}</div>
              </div>
              <div className="actions actions--tight">
                <IconBtn
                  title="Open entity"
                  aria-label="Open entity"
                  onClick={() => currentTarget?.relPath && onJumpToEntity(currentTarget.relPath)}
                  disabled={!currentTarget?.relPath}
                >
                  <ExternalLink className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  title="Edit relationship"
                  aria-label="Edit relationship"
                  onClick={() => openRelationshipDialog(idx)}
                >
                  <Pencil className="h-4 w-4" />
                </IconBtn>
                <IconBtn title="Remove relationship" onClick={() => removeRelationship(idx)}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            <div className="section-header" style={{ marginTop: 12 }}>
              <label>Mappings</label>
              <div className="actions actions--tight">
                <ActionButton variant="ghost" onClick={toggleCollapsed}>
                  {isCollapsed ? `Show mappings (${mappings.length})` : "Hide mappings"}
                </ActionButton>
                <ActionButton
                  variant="ghost"
                  onClick={addMapping}
                  disabled={!sourceColumns.length || !targetColumns.length}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  Add Mapping
                </ActionButton>
              </div>
            </div>

            {!isCollapsed ? (
              mappings.length ? (
                <div className="table entity-mapping-table">
                  <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 0.3fr 1.4fr 0.6fr" }}>
                    <div>Source Column</div>
                    <div></div>
                    <div>Target Column</div>
                    <div>Actions</div>
                  </div>
                  {mappings.map((m: any, mIdx: number) => {
                    return (
                      <div
                        className="table-row"
                        key={`${idx}-rel-map-${mIdx}`}
                        style={{ gridTemplateColumns: "1.4fr 0.3fr 1.4fr 0.6fr" }}
                      >
                        <div>
                          <FormSelect
                            value={m.source || ""}
                            onChange={(val) => {
                              markEntityDirty();
                              setRelationships((list) =>
                                list.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        mappings: (r.mappings || []).map((item: any, ii: number) =>
                                          ii === mIdx ? { ...item, source: val } : item,
                                        ),
                                      }
                                    : r,
                                ),
                              );
                              onRelationshipChange?.();
                            }}
                            options={[
                              ...sourceColumns.map((col) => ({ value: col, label: col })),
                              ...(m.source && !sourceColumns.includes(m.source) ? [{ value: m.source, label: m.source }] : []),
                            ]}
                            placeholder="Select source column"
                          />
                        </div>
                        <div className="arrow-cell">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <FormSelect
                            value={m.target || ""}
                            onChange={(val) => {
                              markEntityDirty();
                              setRelationships((list) =>
                                list.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        mappings: (r.mappings || []).map((item: any, ii: number) =>
                                          ii === mIdx ? { ...item, target: val } : item,
                                        ),
                                      }
                                    : r,
                                ),
                              );
                              onRelationshipChange?.();
                            }}
                            disabled={!rel.targetModelEntityId}
                            options={[
                              ...targetColumns.map((col: string) => ({ value: col, label: col })),
                              ...(m.target && !targetColumns.includes(m.target) ? [{ value: m.target, label: m.target }] : []),
                            ]}
                            placeholder="Select target column"
                          />
                        </div>
                        <div className="actions actions--tight">
                          <IconBtn
                            title="Remove mapping"
                            onClick={() => {
                              markEntityDirty();
                              setRelationships((list) =>
                                list.map((r, i) =>
                                  i === idx ? { ...r, mappings: (r.mappings || []).filter((_item: any, ii: number) => ii !== mIdx) } : r,
                                ),
                              );
                              onRelationshipChange?.();
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconBtn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="muted small">No mappings yet</div>
              )
            ) : null}
          </div>
        );
      })}
      <Dialog open={!!relationshipDialog} onOpenChange={(open) => !open && setRelationshipDialog(null)}>
        <DialogContent className="entity-linkage-dialog max-w-3xl">
          <DialogHeader>
            <DialogTitle>{relationshipDialog?.index === null ? "Add Relationship" : "Edit Relationship"}</DialogTitle>
            <DialogDescription>Select a target entity and at least one complete mapping.</DialogDescription>
          </DialogHeader>
          {relationshipDialog ? (
            <div className="grid gap-4">
              <div className="form-grid">
                <div>
                  <label>Zone *</label>
                  <FormSelect
                    value={relationshipDialog.zone}
                    onChange={(zone) =>
                      setRelationshipDialog((draft) =>
                        draft
                          ? {
                          ...draft,
                          zone,
                          targetModelEntityId: null,
                          mappings: [],
                        }
                          : draft,
                      )
                    }
                    options={[{ value: "", label: "Select zone" }, ...zones.map((z) => ({ value: z, label: z }))]}
                    placeholder="Select zone"
                  />
                </div>
                <div>
                  <label>Target Entity *</label>
                  <FormSelect
                    value={`${relationshipDialog.targetModelEntityId ?? ""}`}
                    onChange={(value) =>
                      setRelationshipDialog((draft) => {
                        if (!draft) return draft;
                        const targetModelEntityId = value ? Number(value) : null;
                        const target = dialogTargetCandidates.find((candidate) => candidate.content?.id === targetModelEntityId);
                        const targetColumns = (target?.content?.attributes || [])
                          .map((a: any) => (typeof a?.name === "string" ? a.name : ""))
                          .filter((name: string) => name.trim().length > 0);
                        return {
                          ...draft,
                          targetModelEntityId,
                          mappings: [],
                        };
                      })
                    }
                    disabled={!relationshipDialog.zone}
                    options={[
                      { value: "", label: "Select target" },
                      ...dialogTargetCandidates.map((ent) => ({ value: `${ent.content?.id ?? ""}`, label: ent.name })),
                    ]}
                    placeholder="Select target"
                  />
                </div>
              </div>
              <div className="section-header">
                <label>Mappings *</label>
                <ActionButton
                  variant="ghost"
                  disabled={!sourceColumns.length || !dialogTargetColumns.length}
                  onClick={() =>
                    setRelationshipDialog((draft) =>
                      draft
                        ? {
                            ...draft,
                            mappings: [
                              ...draft.mappings,
                              { source: sourceColumns[0] || "", target: dialogTargetColumns[0] || "" },
                            ],
                          }
                        : draft,
                    )
                  }
                >
                  Add Mapping
                </ActionButton>
              </div>
              {relationshipDialog.mappings.length ? (
                <div className="table entity-mapping-table">
                  {relationshipDialog.mappings.map((mapping, mappingIdx) => (
                    <div className="table-row" key={`relationship-dialog-map-${mappingIdx}`} style={{ gridTemplateColumns: "1fr 1fr 0.3fr" }}>
                      <FormSelect
                        value={mapping.source}
                        onChange={(source) =>
                          setRelationshipDialog((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  mappings: draft.mappings.map((item, idx) => (idx === mappingIdx ? { ...item, source } : item)),
                                }
                              : draft,
                          )
                        }
                        options={sourceColumns.map((column) => ({ value: column, label: column }))}
                        placeholder="Source column"
                      />
                      <FormSelect
                        value={mapping.target}
                        onChange={(target) =>
                          setRelationshipDialog((draft) =>
                            draft
                              ? {
                                  ...draft,
                                  mappings: draft.mappings.map((item, idx) => (idx === mappingIdx ? { ...item, target } : item)),
                                }
                              : draft,
                          )
                        }
                        options={dialogTargetColumns.map((column: string) => ({ value: column, label: column }))}
                        placeholder="Target column"
                      />
                      <IconBtn
                        title="Remove mapping"
                        onClick={() =>
                          setRelationshipDialog((draft) =>
                            draft ? { ...draft, mappings: draft.mappings.filter((_item, idx) => idx !== mappingIdx) } : draft,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted small">Select a target entity with attributes to create mappings.</div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRelationshipDialog(null)}>
              Cancel
            </Button>
            <Button onClick={saveRelationshipDialog} disabled={!canSaveDialog}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
