import type React from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Input,
} from "@datam8/ui";
import { ArrowRight, ChevronDown, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import type { ModelEntity, PropertyOption } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { IconBtn } from "../common/IconBtn";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import { ExternalSourceConfigurator } from "../../wizard/SourceRow";
import { resolveSourceOverride } from "../../wizard/sourceOverride";
import { normalizeDataTypeForSave } from "../utils/sourceNormalization";

export type EntitySourcesEditorHandle = {
  addInternalSource: () => void;
  addExternalSource: () => void;
};

type EntitySourcesEditorProps = {
  sources: any[];
  setSources: React.Dispatch<React.SetStateAction<any[]>>;
  propertyOptions: PropertyOption[];
  collapsedMappings: Record<number, boolean>;
  setCollapsedMappings: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  openMappingDetails: Record<string, boolean>;
  setOpenMappingDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  zones: string[];
  modelEntities: ModelEntity[];
  resolveEntityMetaById: (id: any) => any;
  onJumpToEntity: (relPath: string) => void;
  onJumpToDataSource: (name: string) => void;
  markEntityDirty: () => void;
  dataSourceOptions: string[];
  dataSourceDetails: Record<string, any>;
  solutionPath: string;
  currentEntityAttributeNames: string[];
  onPatchBaseEntity: (relPath: string, updater: (content: any) => any) => void;
  dataSourcesRelPath: string | null;
  onAdoptExternalSourceSchema?: (sourceIndex: number) => void;
  adoptingExternalSchemaIndex?: number | null;
  onDeleteSource?: () => void;
  onSourceChange?: () => void;
  onMappingChange?: () => void;
  onSourcePropertyChange?: () => void;
};

type SourceMappingsProps = {
  source: any;
  sourceIdx: number;
  propertyOptions: PropertyOption[];
  openMappingDetails: Record<string, boolean>;
  setOpenMappingDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  collapsedMappings: Record<number, boolean>;
  setCollapsedMappings: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  updateSource: (idx: number, updater: (src: any) => any) => void;
  onMappingChange?: () => void;
  isExternal: boolean;
  sourceAttributeNames: string[];
  currentEntityAttributeNames: string[];
  onAdoptExternalSchema?: () => void;
  isAdoptingExternalSchema?: boolean;
};

type SourcePropertiesProps = {
  source: any;
  sourceIdx: number;
  propertyOptions: PropertyOption[];
  updateSource: (idx: number, updater: (src: any) => any) => void;
  onSourcePropertyChange?: () => void;
  className?: string;
};

type InternalSourceCardProps = {
  source: any;
  index: number;
  propertyOptions: PropertyOption[];
  collapsedMappings: Record<number, boolean>;
  setCollapsedMappings: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  openMappingDetails: Record<string, boolean>;
  setOpenMappingDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  resolveEntityMetaById: (id: any) => any;
  modelEntities: ModelEntity[];
  onJumpToEntity: (relPath: string) => void;
  updateSource: (idx: number, updater: (src: any) => any) => void;
  onMappingChange?: () => void;
  onSourcePropertyChange?: () => void;
  removeSource: (idx: number) => void;
  onEditSource: (idx: number, kind: "internal" | "external") => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  currentEntityAttributeNames: string[];
};

type ExternalSourceCardProps = {
  source: any;
  index: number;
  dataSourceOptions: string[];
  propertyOptions: PropertyOption[];
  collapsedMappings: Record<number, boolean>;
  setCollapsedMappings: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  openMappingDetails: Record<string, boolean>;
  setOpenMappingDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onJumpToEntity: (relPath: string) => void;
  onJumpToDataSource: (name: string) => void;
  updateSource: (idx: number, updater: (src: any) => any) => void;
  onMappingChange?: () => void;
  onSourcePropertyChange?: () => void;
  removeSource: (idx: number) => void;
  onEditSource: (idx: number, kind: "internal" | "external") => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  currentEntityAttributeNames: string[];
  onAdoptExternalSourceSchema?: (sourceIndex: number) => void;
  isAdoptingExternalSchema?: boolean;
};

type SourceDialogState = {
  index: number | null;
  kind: "internal" | "external";
  zone: string;
  entityName: string;
  sourceLocation: string | number;
  dataSource: string;
  sourceAlias: string;
  mapping?: any[];
  externalMeta?: any;
};

export const toPropertyChipItems = (
  properties: any[] | undefined,
  keyPrefix: string,
  title: string,
): PropertyChipItem[] =>
  (Array.isArray(properties) ? properties : [])
    .map((p: any, idx: number): PropertyChipItem | null => {
      const property = `${p?.property ?? ""}`;
      if (!property.trim()) return null;
      return {
        key: `${keyPrefix}-${idx}-${property}`,
        property,
        value: `${p?.value ?? ""}`,
        inherited: false,
        title,
        removeKey: idx,
      };
    })
    .filter((item: PropertyChipItem | null): item is PropertyChipItem => item !== null);

export const toUsedPropertyNameSet = (properties: any[] | undefined): Set<string> =>
  new Set(
    (Array.isArray(properties) ? properties : [])
      .map((p: any) => `${p?.property ?? ""}`)
      .filter((v: string) => v.trim().length > 0),
  );

const displayId = (src: any, idx: number) => {
  const id = src?.id ?? src?.sourceId ?? src?.sourceLocation;
  if (id === undefined || id === null || `${id}` === "") return `source-${idx + 1}`;
  return id;
};

const resolveInternalTarget = (source: any, modelEntities: ModelEntity[], resolveEntityMetaById: (id: any) => any) => {
  if (!source) return null;
  const loc = source.sourceLocation;
  const internalTargetId =
    typeof loc === "number" ? loc : typeof loc === "string" && /^\d+$/.test(loc.trim()) ? Number(loc.trim()) : null;
  const metaById = internalTargetId ? resolveEntityMetaById(internalTargetId) : null;
  if (metaById) return metaById;
  const zone = source.zone;
  const name = source.name;
  if (zone && name) {
    const match = modelEntities.find((m) => {
      const parts = (m.relPath || "").split("/");
      return (
        parts[1] === zone &&
        (m.name === name || m.content?.name === name)
      );
    });
    if (match) {
      const parts = (match.relPath || "").split("/");
      return { name: match.name, relPath: match.relPath, zone: parts[1] };
    }
  }
  return null;
};

const SourceMappings = ({
  source,
  sourceIdx,
  propertyOptions,
  openMappingDetails,
  setOpenMappingDetails,
  collapsedMappings,
  setCollapsedMappings,
  updateSource,
  onMappingChange,
  isExternal,
  sourceAttributeNames,
  currentEntityAttributeNames,
  onAdoptExternalSchema,
  isAdoptingExternalSchema,
}: SourceMappingsProps) => {
  const mappings = source.mapping || [];
  const isCollapsed = collapsedMappings[sourceIdx] ?? true;
  const toggleCollapsed = () => setCollapsedMappings((prev) => ({ ...prev, [sourceIdx]: !isCollapsed }));
  const defaultSourceName = isExternal ? currentEntityAttributeNames[0] || "" : sourceAttributeNames[0] || "";
  const defaultTargetName = currentEntityAttributeNames[0] || "";
  const canAddMapping = !!defaultSourceName && !!defaultTargetName;
  const addMapping = () => {
    if (!canAddMapping) return;
    updateSource(sourceIdx, (s) => ({
      ...s,
      mapping: [...(s.mapping || []), { sourceName: defaultSourceName, targetName: defaultTargetName }],
    }));
    setCollapsedMappings((prev) => ({ ...prev, [sourceIdx]: false }));
    onMappingChange?.();
  };
  const baseSourceOptions = useMemo(
    () => sourceAttributeNames.map((name) => ({ value: name, label: name })),
    [sourceAttributeNames],
  );
  const baseTargetOptions = useMemo(
    () => currentEntityAttributeNames.map((name) => ({ value: name, label: name })),
    [currentEntityAttributeNames],
  );
  const withMissingOption = (options: { value: string; label: string }[], value?: string) => {
    if (!value) return options;
    if (options.some((opt) => opt.value === value)) return options;
    return [...options, { value, label: `${value} (missing)` }];
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-header">
        <label>Mappings</label>
        <div className="actions actions--tight">
          <ActionButton variant="ghost" onClick={toggleCollapsed}>
            {isCollapsed ? `Show mappings (${mappings.length})` : "Hide mappings"}
          </ActionButton>
          {isExternal && onAdoptExternalSchema ? (
            <ActionButton variant="ghost" onClick={onAdoptExternalSchema} disabled={!mappings.length || isAdoptingExternalSchema}>
              {isAdoptingExternalSchema ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Adopting…
                </>
              ) : (
                "Adopt Schema"
              )}
            </ActionButton>
          ) : null}
          <ActionButton
            variant="ghost"
            onClick={addMapping}
            disabled={!canAddMapping}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Add Mapping
          </ActionButton>
        </div>
      </div>
      {!isCollapsed ? (
        mappings.length ? (
          <div className="table entity-mapping-table">
            <div className="table-row table-head" style={{ gridTemplateColumns: "1.2fr 0.2fr 1.2fr 1.4fr 0.6fr" }}>
              <div>Source</div>
              <div></div>
              <div>Target</div>
              <div>Properties</div>
              <div>Actions</div>
            </div>
            {mappings.map((m: any, mIdx: number) => {
              const mapKey = `${sourceIdx}-map-${mIdx}`;
              const mappingProps = Array.isArray(m?.properties) ? m.properties : [];
              const toggleDetails = () => setOpenMappingDetails((prev) => ({ ...prev, [mapKey]: !prev[mapKey] }));
              const mappingPropertyItems = toPropertyChipItems(mappingProps, `${mapKey}-prop`, "Mapping property");
              const mappingUsedPropertyNames = toUsedPropertyNameSet(mappingProps);
              return (
                <div key={mapKey} className={`value-row ${isExternal && openMappingDetails[mapKey] ? "value-row--active" : ""}`}>
                  <div className="table-row" style={{ gridTemplateColumns: "1.2fr 0.2fr 1.2fr 1.4fr 0.6fr" }}>
                    <div>
                      {isExternal ? (
                        <input
                          value={m.sourceName || ""}
                          onChange={(e) =>
                            updateSource(sourceIdx, (s) => ({
                              ...s,
                              mapping: (s.mapping || []).map((item: any, ii: number) =>
                                ii === mIdx ? { ...item, sourceName: e.target.value } : item,
                              ),
                            }))
                          }
                        />
                      ) : (
                        <FormSelect
                          value={m.sourceName || ""}
                          onChange={(val) => {
                            updateSource(sourceIdx, (s) => ({
                              ...s,
                              mapping: (s.mapping || []).map((item: any, ii: number) =>
                                ii === mIdx ? { ...item, sourceName: val } : item,
                              ),
                            }));
                            onMappingChange?.();
                          }}
                          options={withMissingOption(baseSourceOptions, m.sourceName)}
                          placeholder="Select source attribute"
                        />
                      )}
                    </div>
                    <div className="arrow-cell">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      {isExternal ? (
                        <input
                          value={m.targetName || ""}
                          onChange={(e) =>
                            updateSource(sourceIdx, (s) => ({
                              ...s,
                              mapping: (s.mapping || []).map((item: any, ii: number) =>
                                ii === mIdx ? { ...item, targetName: e.target.value } : item,
                              ),
                            }))
                          }
                        />
                      ) : (
                        <FormSelect
                          value={m.targetName || ""}
                          onChange={(val) => {
                            updateSource(sourceIdx, (s) => ({
                              ...s,
                              mapping: (s.mapping || []).map((item: any, ii: number) =>
                                ii === mIdx ? { ...item, targetName: val } : item,
                              ),
                            }));
                            onMappingChange?.();
                          }}
                          options={withMissingOption(baseTargetOptions, m.targetName)}
                          placeholder="Select target attribute"
                        />
                      )}
                    </div>
                    <div>
                      <PropertyChips
                        className="chips--sm"
                        items={mappingPropertyItems}
                        propertyOptions={propertyOptions}
                        usedPropertyNames={mappingUsedPropertyNames}
                        onAdd={(property, value) => {
                          updateSource(sourceIdx, (s) => ({
                            ...s,
                            mapping: (s.mapping || []).map((item: any, ii: number) =>
                              ii === mIdx
                                ? {
                                    ...item,
                                    properties: [...(item.properties || []), { property, value }],
                                  }
                                : item,
                            ),
                          }));
                          onMappingChange?.();
                        }}
                        onRemove={(idx) => {
                          updateSource(sourceIdx, (s) => ({
                            ...s,
                            mapping: (s.mapping || []).map((item: any, ii: number) =>
                              ii === mIdx
                                ? {
                                    ...item,
                                    properties: (item.properties || []).filter((_mp: any, mpi: number) => mpi !== Number(idx)),
                                  }
                                : item,
                            ),
                          }));
                          onMappingChange?.();
                        }}
                        addLabel="Add mapping property"
                      />
                    </div>
                    <div className="actions actions--tight">
                      <IconBtn
                        title="Remove mapping"
                        onClick={() => {
                          updateSource(sourceIdx, (s) => ({
                            ...s,
                            mapping: (s.mapping || []).filter((_item: any, ii: number) => ii !== mIdx),
                          }));
                          onMappingChange?.();
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                      {isExternal ? (
                        <IconBtn active={!!openMappingDetails[mapKey]} title="Details" onClick={toggleDetails}>
                          <ChevronDown
                            className={`h-4 w-4 chevron-toggle ${openMappingDetails[mapKey] ? "chevron-toggle--open" : ""}`}
                          />
                        </IconBtn>
                      ) : null}
                    </div>
                  </div>
                  {isExternal && openMappingDetails[mapKey] ? (
                    <div className="source-block">
                      <div className="form-grid">
                        <div>
                          <label>Source Data Type</label>
                          <input value={m.sourceDataType?.type || ""} readOnly />
                        </div>
                        <div className="boolean-cell">
                          <label style={{ marginRight: 8 }}>Nullable</label>
                          <Checkbox checked={m.sourceDataType?.nullable ?? true} disabled />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="muted small">No mappings yet.</div>
        )
      ) : null}
    </div>
  );
};

const SourcePropertiesChips = ({ source, sourceIdx, propertyOptions, updateSource, onSourcePropertyChange, className }: SourcePropertiesProps) => {
  const rawProps = useMemo(() => (Array.isArray(source?.properties) ? source.properties : []), [source?.properties]);
  const propertyItems = useMemo(
    () => toPropertyChipItems(rawProps, `${sourceIdx}-prop-chip`, "Source property"),
    [rawProps, sourceIdx],
  );
  const usedPropertyNames = useMemo(() => toUsedPropertyNameSet(rawProps), [rawProps]);

  return (
    <PropertyChips
      className={className}
      items={propertyItems}
      propertyOptions={propertyOptions}
      usedPropertyNames={usedPropertyNames}
      onAdd={(property, value) => {
        updateSource(sourceIdx, (s) => ({
          ...s,
          properties: [...(s.properties || []), { property, value }],
        }));
        onSourcePropertyChange?.();
      }}
      onRemove={(idx) => {
        updateSource(sourceIdx, (s) => ({
          ...s,
          properties: (s.properties || []).filter((_p: any, ii: number) => ii !== Number(idx)),
        }));
        onSourcePropertyChange?.();
      }}
      addLabel="Add source property"
    />
  );
};

const InternalSourceCard = ({
  source,
  index,
  propertyOptions,
  collapsedMappings,
  setCollapsedMappings,
  openMappingDetails,
  setOpenMappingDetails,
  resolveEntityMetaById,
  modelEntities,
  onJumpToEntity,
  updateSource,
  onMappingChange,
  onSourcePropertyChange,
  removeSource,
  onEditSource,
  cardRef,
  currentEntityAttributeNames,
}: InternalSourceCardProps) => {
  const targetMeta = resolveInternalTarget(source, modelEntities, resolveEntityMetaById);
  const displayName = source.name || targetMeta?.name || "Internal source";
  const zoneValue = source.zone || targetMeta?.zone || "";
  const eyebrowText = `Internal - Zone: ${zoneValue || "Select zone"}`;
  const targetEntity = useMemo(
    () => (targetMeta ? modelEntities.find((ent) => ent.relPath === targetMeta.relPath) : null),
    [modelEntities, targetMeta],
  );
  const sourceAttributeNames = useMemo(
    () =>
      (targetEntity?.content?.attributes || [])
        .map((attr: any) => (typeof attr?.name === "string" ? attr.name : ""))
        .filter((name: string) => name.trim().length > 0),
    [targetEntity],
  );
  return (
    <div className="source-block source-block--internal" key={index} ref={cardRef}>
      <div className="section-header" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="source-eyebrow" title={eyebrowText}>
            <span className="source-kind source-kind--internal">Internal</span>
            {` - Zone: ${zoneValue || "Select zone"}`}
          </div>
          <div className="section-title source-title">{displayName}</div>
          <SourcePropertiesChips
            className="source-properties chips--sm"
            source={source}
            sourceIdx={index}
            propertyOptions={propertyOptions}
            updateSource={updateSource}
            onSourcePropertyChange={onSourcePropertyChange}
          />
        </div>
        <div className="actions actions--tight">
          <IconBtn
            title="Open entity"
            aria-label="Open entity"
            onClick={() => targetMeta?.relPath && onJumpToEntity(targetMeta.relPath)}
            disabled={!targetMeta?.relPath}
          >
            <ExternalLink className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Edit source"
            aria-label="Edit source"
            onClick={() => onEditSource(index, "internal")}
          >
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Delete source"
            onClick={() => removeSource(index)}
          >
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
      <SourceMappings
        source={source}
        sourceIdx={index}
        propertyOptions={propertyOptions}
        openMappingDetails={openMappingDetails}
        setOpenMappingDetails={setOpenMappingDetails}
        collapsedMappings={collapsedMappings}
        setCollapsedMappings={setCollapsedMappings}
        updateSource={updateSource}
        onMappingChange={onMappingChange}
        isExternal={false}
        sourceAttributeNames={sourceAttributeNames}
        currentEntityAttributeNames={currentEntityAttributeNames}
      />
    </div>
  );
};

const ExternalSourceCard = ({
  source,
  index,
  dataSourceOptions,
  propertyOptions,
  collapsedMappings,
  setCollapsedMappings,
  openMappingDetails,
  setOpenMappingDetails,
  onJumpToEntity,
  onJumpToDataSource,
  updateSource,
  onMappingChange,
  onSourcePropertyChange,
  removeSource,
  onEditSource,
  cardRef,
  currentEntityAttributeNames,
  onAdoptExternalSourceSchema,
  isAdoptingExternalSchema,
}: ExternalSourceCardProps) => {
  const title = source.sourceAlias || source.sourceLocation || "External source";
  const eyebrowText = `External - Data source: ${source.dataSource || "Select data source"} - Location: ${source.sourceLocation || "Set location"}`;
  return (
    <div className="source-block source-block--external" key={index} ref={cardRef}>
      <div className="section-header" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="source-eyebrow" title={eyebrowText}>
            <span className="source-kind source-kind--external">External</span>
            {` - Data source: ${source.dataSource || "Select data source"}`}
            {` - Location: ${source.sourceLocation || "Set location"}`}
          </div>
          <div className="section-title source-title">{title}</div>
          <SourcePropertiesChips
            className="source-properties chips--sm"
            source={source}
            sourceIdx={index}
            propertyOptions={propertyOptions}
            updateSource={updateSource}
            onSourcePropertyChange={onSourcePropertyChange}
          />
        </div>
        <div className="actions actions--tight">
          <IconBtn
            title="Open data source"
            aria-label="Open data source"
            disabled={!source.dataSource}
            onClick={() => source.dataSource && onJumpToDataSource(source.dataSource)}
          >
            <ExternalLink className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Edit source"
            aria-label="Edit source"
            onClick={() => onEditSource(index, "external")}
          >
            <Pencil className="h-4 w-4" />
          </IconBtn>
          <IconBtn
            title="Delete source"
            onClick={() => removeSource(index)}
          >
            <Trash2 className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
      <SourceMappings
        source={source}
        sourceIdx={index}
        propertyOptions={propertyOptions}
        openMappingDetails={openMappingDetails}
        setOpenMappingDetails={setOpenMappingDetails}
        collapsedMappings={collapsedMappings}
        setCollapsedMappings={setCollapsedMappings}
        updateSource={updateSource}
        onMappingChange={onMappingChange}
        isExternal={true}
        sourceAttributeNames={[]}
        currentEntityAttributeNames={currentEntityAttributeNames}
        onAdoptExternalSchema={
          onAdoptExternalSourceSchema
            ? () => onAdoptExternalSourceSchema(index)
            : undefined
        }
        isAdoptingExternalSchema={isAdoptingExternalSchema}
      />
    </div>
  );
};

export const EntitySourcesEditor = forwardRef<EntitySourcesEditorHandle, EntitySourcesEditorProps>(function EntitySourcesEditor(
  {
    sources,
    setSources,
    propertyOptions,
    collapsedMappings,
    setCollapsedMappings,
    openMappingDetails,
    setOpenMappingDetails,
    zones,
    modelEntities,
    resolveEntityMetaById,
    onJumpToEntity,
    onJumpToDataSource,
    markEntityDirty,
    dataSourceOptions,
    dataSourceDetails,
    solutionPath,
    currentEntityAttributeNames,
    onPatchBaseEntity,
    dataSourcesRelPath,
    onAdoptExternalSourceSchema,
    adoptingExternalSchemaIndex,
    onDeleteSource,
    onSourceChange,
    onMappingChange,
    onSourcePropertyChange,
  },
  ref,
) {
  const sourceCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pendingSourceIndexRef = useRef<number | null>(null);
  const [sourceDialog, setSourceDialog] = useState<SourceDialogState | null>(null);
  const [showExternalBrowser, setShowExternalBrowser] = useState(false);

  useEffect(() => {
    if (pendingSourceIndexRef.current !== null) {
      const idx = pendingSourceIndexRef.current;
      requestAnimationFrame(() => {
        sourceCardRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      pendingSourceIndexRef.current = null;
    }
  }, [sources.length]);

  const updateSource = (idx: number, updater: (src: any) => any) => {
    markEntityDirty();
    setSources((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        return updater(s);
      }),
    );
  };

  const removeSource = (idx: number) => {
    if (!window.confirm("Delete this source?")) return;
    markEntityDirty();
    setSources((list) => list.filter((_s, i) => i !== idx));
    setCollapsedMappings({});
    setOpenMappingDetails({});
    onDeleteSource?.();
  };

  const openSourceDialog = useCallback((index: number | null, kind: "internal" | "external") => {
    if (index === null) {
      setSourceDialog({
        index: null,
        kind,
        zone: "",
        entityName: "",
        sourceLocation: "",
        dataSource: "",
        sourceAlias: "",
      });
      return;
    }
    const source = sources[index] || {};
    const target = kind === "internal" ? resolveInternalTarget(source, modelEntities, resolveEntityMetaById) : null;
    setSourceDialog({
      index,
      kind,
      zone: source.zone || target?.zone || "",
      entityName: source.name || target?.name || "",
      sourceLocation: source.sourceLocation ?? "",
      dataSource: source.dataSource || "",
      sourceAlias: source.sourceAlias || "",
      mapping: source.mapping,
      externalMeta: source.__uiExternalMeta,
    });
  }, [modelEntities, resolveEntityMetaById, sources]);

  const addInternalSource = useCallback(() => {
    openSourceDialog(null, "internal");
  }, [openSourceDialog]);

  const addExternalSource = useCallback(() => {
    openSourceDialog(null, "external");
  }, [openSourceDialog]);

  const commitSourceDialog = useCallback(() => {
    if (!sourceDialog) return;
    let nextSource: any | null = null;
    if (sourceDialog.kind === "internal") {
      const match = modelEntities.find((ent) => {
        const parts = (ent.relPath || "").split("/");
        return parts[1] === sourceDialog.zone && ent.name === sourceDialog.entityName;
      });
      if (!match?.content?.id) return;
      nextSource = {
        type: "internal",
        zone: sourceDialog.zone,
        name: sourceDialog.entityName,
        sourceLocation: match.content.id,
        ...(sourceDialog.mapping?.length ? { mapping: sourceDialog.mapping } : {}),
      };
    } else {
      const dataSource = sourceDialog.dataSource.trim();
      const sourceLocation = typeof sourceDialog.sourceLocation === "string" ? sourceDialog.sourceLocation.trim() : sourceDialog.sourceLocation;
      if (!dataSource || !sourceLocation) return;
      nextSource = {
        type: "external",
        dataSource,
        sourceLocation,
        ...(sourceDialog.sourceAlias.trim() ? { sourceAlias: sourceDialog.sourceAlias.trim() } : {}),
        ...(sourceDialog.mapping?.length ? { mapping: sourceDialog.mapping } : {}),
        ...(sourceDialog.externalMeta ? { __uiExternalMeta: sourceDialog.externalMeta } : {}),
      };
    }
    markEntityDirty();
    if (sourceDialog.index === null) {
      pendingSourceIndexRef.current = sources.length;
      setSources((list) => {
        const nextIdx = list.length;
        setCollapsedMappings((prev) => ({ ...prev, [nextIdx]: true }));
        return [...list, nextSource];
      });
    } else {
      setSources((list) => list.map((source, idx) => (idx === sourceDialog.index ? { ...source, ...nextSource } : source)));
    }
    onSourceChange?.();
    setSourceDialog(null);
  }, [markEntityDirty, modelEntities, onSourceChange, setCollapsedMappings, setSources, sourceDialog, sources.length]);

  useImperativeHandle(
    ref,
    () => ({
      addInternalSource,
      addExternalSource,
    }),
    [addExternalSource, addInternalSource],
  );

  const sourceDialogEntityOptions = useMemo(() => {
    if (!sourceDialog || sourceDialog.kind !== "internal") return [];
    return modelEntities
      .filter((ent) => {
        const parts = (ent.relPath || "").split("/");
        return parts[1] === sourceDialog.zone;
      })
      .map((ent) => ({ value: ent.name, label: ent.name }));
  }, [modelEntities, sourceDialog]);
  const sourceDialogCanSave =
    !!sourceDialog &&
    (sourceDialog.kind === "internal"
      ? !!sourceDialog.zone && !!sourceDialog.entityName
      : !!sourceDialog.dataSource.trim() && `${sourceDialog.sourceLocation ?? ""}`.trim().length > 0);
  const sourceDialogDataSourceObject =
    sourceDialog?.kind === "external" && sourceDialog.dataSource ? dataSourceDetails[sourceDialog.dataSource] || {} : {};

  return (
    <div>
      {sources.map((src, idx) => {
        const isExternal = Object.prototype.hasOwnProperty.call(src ?? {}, "dataSource") || src?.type === "external";
        return isExternal ? (
          <ExternalSourceCard
            key={`source-${idx}`}
            source={src}
            index={idx}
            dataSourceOptions={dataSourceOptions}
            propertyOptions={propertyOptions}
            collapsedMappings={collapsedMappings}
            setCollapsedMappings={setCollapsedMappings}
            openMappingDetails={openMappingDetails}
            setOpenMappingDetails={setOpenMappingDetails}
            onJumpToEntity={onJumpToEntity}
            onJumpToDataSource={onJumpToDataSource}
            updateSource={updateSource}
            onMappingChange={onMappingChange}
            onSourcePropertyChange={onSourcePropertyChange}
            removeSource={removeSource}
            onEditSource={openSourceDialog}
            currentEntityAttributeNames={currentEntityAttributeNames}
            onAdoptExternalSourceSchema={onAdoptExternalSourceSchema}
            isAdoptingExternalSchema={adoptingExternalSchemaIndex === idx}
            cardRef={(el) => {
              sourceCardRefs.current[idx] = el;
            }}
          />
        ) : (
          <InternalSourceCard
            key={`source-${idx}`}
            source={src}
            index={idx}
            propertyOptions={propertyOptions}
            collapsedMappings={collapsedMappings}
            setCollapsedMappings={setCollapsedMappings}
            openMappingDetails={openMappingDetails}
            setOpenMappingDetails={setOpenMappingDetails}
            resolveEntityMetaById={resolveEntityMetaById}
            modelEntities={modelEntities}
            onJumpToEntity={onJumpToEntity}
            updateSource={updateSource}
            onMappingChange={onMappingChange}
            onSourcePropertyChange={onSourcePropertyChange}
            removeSource={removeSource}
            onEditSource={openSourceDialog}
            currentEntityAttributeNames={currentEntityAttributeNames}
            cardRef={(el) => {
              sourceCardRefs.current[idx] = el;
            }}
          />
        );
      })}
      <Dialog open={!!sourceDialog} onOpenChange={(open) => {
        if (!open) {
          setSourceDialog(null);
          setShowExternalBrowser(false);
        }
      }}>
        <DialogContent className="entity-linkage-dialog max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {sourceDialog?.index === null ? "Add" : "Edit"} {sourceDialog?.kind === "external" ? "External Source" : "Internal Source"}
            </DialogTitle>
            <DialogDescription>Complete the required fields before the source is added to the entity.</DialogDescription>
          </DialogHeader>
          {sourceDialog?.kind === "internal" ? (
            <div className="form-grid">
              <div>
                <label>Zone *</label>
                <FormSelect
                  value={sourceDialog.zone}
                  onChange={(zone) => setSourceDialog((draft) => draft ? { ...draft, zone, entityName: "", sourceLocation: "" } : draft)}
                  options={[{ value: "", label: "Select zone" }, ...zones.map((zone) => ({ value: zone, label: zone }))]}
                  placeholder="Select zone"
                />
              </div>
              <div>
                <label>Entity *</label>
                <FormSelect
                  value={sourceDialog.entityName}
                  onChange={(entityName) => setSourceDialog((draft) => draft ? { ...draft, entityName } : draft)}
                  disabled={!sourceDialog.zone}
                  options={[{ value: "", label: "Select entity" }, ...sourceDialogEntityOptions]}
                  placeholder="Select entity"
                />
              </div>
            </div>
          ) : sourceDialog?.kind === "external" ? (
            <div className="form-grid">
              <div>
                <label>Data source *</label>
                <FormSelect
                  value={sourceDialog.dataSource}
                  onChange={(dataSource) => setSourceDialog((draft) => draft ? { ...draft, dataSource, sourceLocation: "" } : draft)}
                  options={[{ value: "", label: "Select data source" }, ...dataSourceOptions.map((dataSource) => ({ value: dataSource, label: dataSource }))]}
                  placeholder="Select data source"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label-token mb-0">Source location *</label>
                  <ActionButton
                    variant="ghost"
                    onClick={() => setShowExternalBrowser(true)}
                    disabled={!sourceDialog.dataSource}
                    className="h-auto px-0 py-0 action-link hover:bg-transparent"
                  >
                    List tables
                  </ActionButton>
                </div>
                <Input
                  placeholder="crm_db.dbo.orders, file path, etc."
                  value={`${sourceDialog.sourceLocation ?? ""}`}
                  onChange={(event) => setSourceDialog((draft) => draft ? { ...draft, sourceLocation: event.target.value } : draft)}
                />
              </div>
              <div>
                <label>Source alias</label>
                <Input
                  placeholder="Alias for display"
                  value={sourceDialog.sourceAlias}
                  onChange={(event) => setSourceDialog((draft) => draft ? { ...draft, sourceAlias: event.target.value } : draft)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSourceDialog(null)}>
              Cancel
            </Button>
            <Button onClick={commitSourceDialog} disabled={!sourceDialogCanSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!sourceDialog && sourceDialog.kind === "external" && showExternalBrowser} onOpenChange={setShowExternalBrowser}>
        <DialogContent className="entity-wizard max-h-[84vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Change entity</DialogTitle>
          </DialogHeader>
          {sourceDialog?.kind === "external" ? (
            <ExternalSourceConfigurator
              dataSource={sourceDialog.dataSource}
              dataSourceObject={sourceDialogDataSourceObject}
              solutionPath={solutionPath}
              selectedTable={`${sourceDialog.sourceLocation ?? ""}`}
              mode="wizard-single"
              onCancel={() => setShowExternalBrowser(false)}
              onTableSelected={(table, meta) => {
                setSourceDialog((draft) => {
                  if (!draft || draft.kind !== "external") return draft;
                  const resolved = resolveSourceOverride({
                    sourceOverride: meta?.sourceOverride,
                    fallbackDataSource: draft.dataSource,
                    fallbackLocation: table,
                    dataSources: dataSourceOptions,
                  });
                  const mapping =
                    meta?.columns?.map((col: any) => {
                      const sourceDataType = normalizeDataTypeForSave({
                        type: col.dataType,
                        nullable: col.isNullable,
                        charLen: col.maxLength,
                        precision: col.numericPrecision,
                        scale: col.numericScale,
                      });
                      return sourceDataType
                        ? { targetName: col.name, sourceName: col.name, sourceDataType }
                        : { targetName: col.name, sourceName: col.name };
                    }) || draft.mapping;
                  return {
                    ...draft,
                    dataSource: resolved.dataSource || draft.dataSource,
                    sourceLocation: resolved.sourceLocation ?? table,
                    mapping,
                    externalMeta: meta || draft.externalMeta,
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
