import type React from "react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormSelect, Input } from "@datam8/ui";
import type { ModelEntity } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";
import { ExternalSourceConfigurator } from "../../wizard/SourceRow";
import { resolveSourceOverride } from "../../wizard/sourceOverride";

export type EntityRelationshipsEditorHandle = {
  addInternalRelationship: () => void;
  addExternalRelationship: () => void;
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
  onJumpToDataSource: (name: string) => void;
  markEntityDirty: () => void;
  dataSourceOptions: string[];
  dataSourceDetails: Record<string, unknown>;
  solutionPath: string;
  onRelationshipChange?: () => void;
  onDeleteRelationship?: () => void;
};

type RelationshipDialogState = {
  index: number | null;
  kind: "internal" | "external";
  zone: string;
  targetModelEntityId: number | null;
  dataSource: string;
  targetLocation: string;
  alias: string;
  externalMeta?: any;
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
  onJumpToDataSource,
  markEntityDirty,
  dataSourceOptions,
  dataSourceDetails,
  solutionPath,
  onRelationshipChange,
  onDeleteRelationship,
}: EntityRelationshipsEditorProps, ref) {
  const [mappingsCollapsed, setMappingsCollapsed] = useState<Record<number, boolean>>({});
  const [relationshipDialog, setRelationshipDialog] = useState<RelationshipDialogState | null>(null);
  const [showExternalBrowser, setShowExternalBrowser] = useState(false);

  const sourceColumns = useMemo(() => (attributes || []).map((a: any) => a.name).filter(Boolean), [attributes]);

  const openRelationshipDialog = useCallback((idx: number | null, kind: "internal" | "external") => {
    if (idx === null) {
      setRelationshipDialog({
        index: null,
        kind,
        zone: "",
        targetModelEntityId: null,
        dataSource: "",
        targetLocation: "",
        alias: "",
        mappings: [],
      });
      return;
    }
    const rel = relationships[idx];
    const isExternal = !!rel?.dataSource;
    const currentTarget = modelEntities.find((ent) => ent.content?.id === rel?.targetModelEntityId);
    const zone = currentTarget ? getEntityZone(currentTarget, zoneFromRelPath) : relationshipZones[idx] || "";
    setRelationshipDialog({
      index: idx,
      kind: isExternal ? "external" : "internal",
      zone,
      targetModelEntityId: rel?.targetModelEntityId ?? null,
      dataSource: rel?.dataSource || "",
      targetLocation: `${rel?.targetLocation ?? ""}`,
      alias: rel?.alias || "",
      externalMeta: rel?.__uiExternalMeta,
      mappings: (rel?.mappings || []).map((mapping: any) => ({
        source: mapping?.source || "",
        target: mapping?.target || "",
      })),
    });
  }, [modelEntities, relationshipZones, relationships, zoneFromRelPath]);

  useImperativeHandle(
    ref,
    () => ({
      addInternalRelationship: () => openRelationshipDialog(null, "internal"),
      addExternalRelationship: () => openRelationshipDialog(null, "external"),
    }),
    [openRelationshipDialog],
  );

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
  const dialogTargetColumns = relationshipDialog?.kind === "external"
    ? (relationshipDialog.externalMeta?.columns || [])
        .map((column: any) => (typeof column?.name === "string" ? column.name : ""))
        .filter((name: string) => name.trim().length > 0)
    : (dialogTargetEntity?.content?.attributes || [])
        .map((a: any) => (typeof a?.name === "string" ? a.name : ""))
        .filter((name: string) => name.trim().length > 0);
  const canSaveDialog =
    !!relationshipDialog &&
    (relationshipDialog.kind === "external"
      ? !!relationshipDialog.dataSource.trim() && !!relationshipDialog.targetLocation.trim()
      : !!relationshipDialog.zone && relationshipDialog.targetModelEntityId !== null) &&
    relationshipDialog.mappings.some((mapping) => mapping.source.trim() && mapping.target.trim());

  const saveRelationshipDialog = () => {
    if (!relationshipDialog || !canSaveDialog) return;
    const baseRel = {
      mappings: relationshipDialog.mappings
        .map((mapping) => ({ source: mapping.source.trim(), target: mapping.target.trim() }))
        .filter((mapping) => mapping.source && mapping.target),
    };
    const nextRel = relationshipDialog.kind === "external"
      ? {
          ...baseRel,
          dataSource: relationshipDialog.dataSource.trim(),
          targetLocation: relationshipDialog.targetLocation.trim(),
          ...(relationshipDialog.alias.trim() ? { alias: relationshipDialog.alias.trim() } : {}),
          ...(relationshipDialog.externalMeta ? { __uiExternalMeta: relationshipDialog.externalMeta } : {}),
        }
      : {
          ...baseRel,
          targetModelEntityId: relationshipDialog.targetModelEntityId,
          ...(relationshipDialog.alias.trim() ? { alias: relationshipDialog.alias.trim() } : {}),
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
        const isExternal = !!rel?.dataSource;
        const mappings = rel.mappings || [];
        const isCollapsed = mappingsCollapsed[idx] ?? true;
        const currentTarget = modelEntities.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const inferredZone = currentTarget ? zoneFromRelPath(currentTarget.relPath) : "";
        const selectedZone = relationshipZones[idx] || inferredZone || "";
        const targetCandidates = modelEntities.filter((ent) => zoneFromRelPath(ent.relPath) === selectedZone);
        const targetEntity = targetCandidates.find((ent) => ent.content?.id === rel.targetModelEntityId);
        const targetColumns = isExternal
          ? (rel.__uiExternalMeta?.columns || []).map((column: any) => column?.name).filter(Boolean)
          : (targetEntity?.content?.attributes || []).map((a: any) => a.name).filter(Boolean) || [];

        const targetName = rel.targetModelEntityId ? resolveEntityNameById(rel.targetModelEntityId) : "";
        const kindLabel = isExternal ? "External" : "Internal";
        const eyebrowDetails = isExternal
          ? `Data source: ${rel.dataSource || "Select data source"} - Target: ${rel.targetLocation || "Set target"}`
          : `Zone: ${selectedZone || "Select zone"}${targetName ? ` - Target: ${targetName}` : ""}`;
        const eyebrowText = `${kindLabel} - ${eyebrowDetails}`;
        const titleText = isExternal ? rel.alias || rel.targetLocation || rel.name || `Relationship ${idx + 1}` : targetName || rel.name || `Relationship ${idx + 1}`;

        const toggleCollapsed = () => setMappingsCollapsed((prev) => ({ ...prev, [idx]: !isCollapsed }));
        const addMapping = () => {
          if (!sourceColumns.length || (!isExternal && !targetColumns.length)) return;
          const newSource = sourceColumns[0];
          const newTarget = targetColumns[0] || "";
          markEntityDirty();
          setRelationships((list) =>
            list.map((r, i) => (i === idx ? { ...r, mappings: [...(r.mappings || []), { source: newSource, target: newTarget }] } : r)),
          );
          setMappingsCollapsed((prev) => ({ ...prev, [idx]: false }));
          onRelationshipChange?.();
        };

        return (
          <div className={`source-block ${isExternal ? "source-block--external" : "source-block--internal"}`} key={idx}>
            <div className="section-header" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="source-eyebrow" title={eyebrowText}>
                  <span className={`source-kind ${isExternal ? "source-kind--external" : "source-kind--internal"}`}>
                    {kindLabel}
                  </span>
                  <span>{eyebrowDetails}</span>
                </div>
                <div className="section-title source-title">{titleText}</div>
              </div>
              <div className="actions actions--tight">
                {isExternal ? (
                  <IconBtn
                    title="Open data source"
                    aria-label="Open data source"
                    onClick={() => rel.dataSource && onJumpToDataSource(rel.dataSource)}
                    disabled={!rel.dataSource}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </IconBtn>
                ) : (
                  <IconBtn
                    title="Open entity"
                    aria-label="Open entity"
                    onClick={() => currentTarget?.relPath && onJumpToEntity(currentTarget.relPath)}
                    disabled={!currentTarget?.relPath}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </IconBtn>
                )}
                <IconBtn
                  title="Open details"
                  aria-label="Open details"
                  onClick={() => openRelationshipDialog(idx, isExternal ? "external" : "internal")}
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
                  disabled={!sourceColumns.length || (!isExternal && !targetColumns.length)}
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
                          {isExternal ? (
                            <Input
                              value={m.target || ""}
                              list={`relationship-${idx}-target-columns`}
                              onChange={(event) => {
                                const val = event.target.value;
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
                            />
                          ) : (
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
                          )}
                          {isExternal && targetColumns.length ? (
                            <datalist id={`relationship-${idx}-target-columns`}>
                              {targetColumns.map((col: string) => (
                                <option key={col} value={col} />
                              ))}
                            </datalist>
                          ) : null}
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
      <Dialog open={!!relationshipDialog} onOpenChange={(open) => {
        if (!open) {
          setRelationshipDialog(null);
          setShowExternalBrowser(false);
        }
      }}>
        <DialogContent className="entity-linkage-dialog max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {relationshipDialog?.index === null ? "Add" : "Edit"} {relationshipDialog?.kind === "external" ? "External" : "Internal"} Relationship
            </DialogTitle>
            <DialogDescription>Select a target and at least one complete mapping.</DialogDescription>
          </DialogHeader>
          {relationshipDialog ? (
            <div className="grid gap-4">
              {relationshipDialog.kind === "internal" ? (
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
              ) : (
                <div className="form-grid">
                  <div>
                    <label>Data source *</label>
                    <FormSelect
                      value={relationshipDialog.dataSource}
                      onChange={(dataSource) =>
                        setRelationshipDialog((draft) =>
                          draft ? { ...draft, dataSource, targetLocation: "", externalMeta: undefined, mappings: [] } : draft,
                        )
                      }
                      options={[{ value: "", label: "Select data source" }, ...dataSourceOptions.map((dataSource) => ({ value: dataSource, label: dataSource }))]}
                      placeholder="Select data source"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-token mb-0">Target location *</label>
                      <ActionButton
                        variant="ghost"
                        onClick={() => setShowExternalBrowser(true)}
                        disabled={!relationshipDialog.dataSource}
                        className="h-auto px-0 py-0 action-link hover:bg-transparent"
                      >
                        List tables
                      </ActionButton>
                    </div>
                    <Input
                      value={relationshipDialog.targetLocation}
                      onChange={(event) =>
                        setRelationshipDialog((draft) => draft ? { ...draft, targetLocation: event.target.value } : draft)
                      }
                      placeholder="dbo.Customer, API path, etc."
                    />
                  </div>
                  <div>
                    <label>Alias</label>
                    <Input
                      value={relationshipDialog.alias}
                      onChange={(event) =>
                        setRelationshipDialog((draft) => draft ? { ...draft, alias: event.target.value } : draft)
                      }
                      placeholder="Alias for display"
                    />
                  </div>
                </div>
              )}
              <div className="section-header">
                <label>Mappings *</label>
                <ActionButton
                  variant="ghost"
                  disabled={!sourceColumns.length || (relationshipDialog.kind === "internal" && !dialogTargetColumns.length)}
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
                      {relationshipDialog.kind === "external" ? (
                        <>
                          <Input
                            value={mapping.target}
                            list="relationship-dialog-target-columns"
                            onChange={(event) =>
                              setRelationshipDialog((draft) =>
                                draft
                                  ? {
                                      ...draft,
                                      mappings: draft.mappings.map((item, idx) =>
                                        idx === mappingIdx ? { ...item, target: event.target.value } : item,
                                      ),
                                    }
                                  : draft,
                              )
                            }
                            placeholder="Target column"
                          />
                          {dialogTargetColumns.length ? (
                            <datalist id="relationship-dialog-target-columns">
                              {dialogTargetColumns.map((column: string) => (
                                <option key={column} value={column} />
                              ))}
                            </datalist>
                          ) : null}
                        </>
                      ) : (
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
                          options={[
                            ...dialogTargetColumns.map((column: string) => ({ value: column, label: column })),
                            ...(mapping.target && !dialogTargetColumns.includes(mapping.target) ? [{ value: mapping.target, label: mapping.target }] : []),
                          ]}
                          placeholder="Target column"
                        />
                      )}
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
      <Dialog open={!!relationshipDialog && relationshipDialog.kind === "external" && showExternalBrowser} onOpenChange={setShowExternalBrowser}>
        <DialogContent className="entity-wizard max-h-[84vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select target</DialogTitle>
          </DialogHeader>
          {relationshipDialog?.kind === "external" ? (
            <ExternalSourceConfigurator
              dataSource={relationshipDialog.dataSource}
              dataSourceObject={(dataSourceDetails[relationshipDialog.dataSource] || {}) as any}
              solutionPath={solutionPath}
              selectedTable={relationshipDialog.targetLocation}
              mode="wizard-single"
              onCancel={() => setShowExternalBrowser(false)}
              onTableSelected={(table, meta) => {
                setRelationshipDialog((draft) => {
                  if (!draft || draft.kind !== "external") return draft;
                  const resolved = resolveSourceOverride({
                    sourceOverride: meta?.sourceOverride,
                    fallbackDataSource: draft.dataSource,
                    fallbackLocation: table,
                    dataSources: dataSourceOptions,
                  });
                  return {
                    ...draft,
                    dataSource: resolved.dataSource || draft.dataSource,
                    targetLocation: `${resolved.sourceLocation ?? table}`,
                    externalMeta: meta,
                    mappings: [],
                  };
                });
                setShowExternalBrowser(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
});
