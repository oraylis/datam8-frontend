import type React from "react";
import { useState } from "react";
import { ArrowRight, Check, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { FormSelect } from "@datam8/ui";
import type { ModelEntity } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";

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

export const EntityRelationshipsEditor = ({
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
}: EntityRelationshipsEditorProps) => {
  const [editing, setEditing] = useState<Record<number, boolean>>({});
  const [mappingsCollapsed, setMappingsCollapsed] = useState<Record<number, boolean>>({});

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
    setEditing((prev) => {
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

  return (
    <div>
      {relationships.map((rel, idx) => {
        const isEditing = editing[idx] ?? false;
        const mappings = rel.mappings || [];
        const isCollapsed = mappingsCollapsed[idx] ?? true;
        const currentTarget = modelEntities.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const inferredZone = currentTarget ? zoneFromRelPath(currentTarget.relPath) : "";
        const selectedZone = relationshipZones[idx] || inferredZone || "";
        const targetCandidates = modelEntities.filter((ent) => zoneFromRelPath(ent.relPath) === selectedZone);
        const sourceColumns = (attributes || []).map((a: any) => a.name).filter(Boolean);
        const targetEntity = targetCandidates.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const targetColumns = (targetEntity?.content?.attributes || []).map((a: any) => a.name).filter(Boolean) || [];

        const targetName = rel.targetModelEntityId ? resolveEntityNameById(rel.targetModelEntityId) : "";
        const eyebrowText = `Zone: ${selectedZone || "Select zone"}${targetName ? ` - Target: ${targetName}` : ""}`;
        const titleText = targetName || rel.name || `Relationship ${idx + 1}`;

        const toggleCollapsed = () => setMappingsCollapsed((prev) => ({ ...prev, [idx]: !isCollapsed }));
        const addMapping = () => {
          const newSource = sourceColumns[0] || "";
          const newTarget = targetColumns[0] || "";
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
                  title={isEditing ? "Done" : "Edit"}
                  aria-label={isEditing ? "Done editing" : "Edit"}
                  onClick={() => setEditing((prev) => ({ ...prev, [idx]: !isEditing }))}
                >
                  {isEditing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </IconBtn>
                <IconBtn title="Remove relationship" onClick={() => removeRelationship(idx)}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            {isEditing ? (
              <div className="form-grid" style={{ marginTop: 8 }}>
                <div>
                  <label>Zone</label>
                  <FormSelect
                    value={selectedZone}
                    onChange={(zone) => {
                      const candidates = modelEntities.filter((ent) => zoneFromRelPath(ent.relPath) === zone);
                      setRelationshipZones((prev) => ({ ...prev, [idx]: zone }));
                      markEntityDirty();
                      setRelationships((list) =>
                        list.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                targetModelEntityId: candidates.some((t) => t.content?.id === r.targetModelEntityId)
                                  ? r.targetModelEntityId
                                  : null,
                              }
                            : r,
                        ),
                      );
                      onRelationshipChange?.();
                    }}
                    options={[{ value: "", label: "Select zone" }, ...zones.map((z) => ({ value: z, label: z }))]}
                    placeholder="Select zone"
                  />
                </div>
                <div>
                  <label>Target Entity</label>
                  <FormSelect
                    value={`${rel.targetModelEntityId ?? ""}`}
                    onChange={(val) => {
                      markEntityDirty();
                      const selectedId = val ? Number(val) : null;
                      setRelationships((list) =>
                        list.map((r, i) => (i === idx ? { ...r, targetModelEntityId: selectedId } : r)),
                      );
                      onRelationshipChange?.();
                    }}
                    disabled={!selectedZone}
                    options={[
                      { value: "", label: "Select target" },
                      ...targetCandidates.map((ent) => ({
                        value: `${ent.content?.id ?? ""}`,
                        label: ent.name,
                      })),
                      ...(rel.targetModelEntityId && !targetCandidates.find((m) => m.content?.id === rel.targetModelEntityId)
                        ? [{ value: `${rel.targetModelEntityId}`, label: `${rel.targetModelEntityId}` }]
                        : []),
                    ]}
                    placeholder="Select target"
                  />
                </div>
              </div>
            ) : null}

            <div className="section-header" style={{ marginTop: 12 }}>
              <label>Mappings</label>
              <div className="actions actions--tight">
                <ActionButton variant="ghost" onClick={toggleCollapsed}>
                  {isCollapsed ? `Show mappings (${mappings.length})` : "Hide mappings"}
                </ActionButton>
                <ActionButton
                  variant="ghost"
                  onClick={addMapping}
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
                              { value: "", label: "Select source column" },
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
                              { value: "", label: "Select target column" },
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
    </div>
  );
};
