import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropertyAssignment } from "@datam8/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Textarea } from "@datam8/ui";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import type { EntitySection, ModelEntity, PropertyOption } from "../../../model-types";
import { ActionButton } from "../common/ActionButton";
import { EditorPanelHeader } from "../common/EditorPanelHeader";
import { IconBtn } from "../common/IconBtn";
import { PropertyChips, type PropertyChipItem } from "../common/PropertyChips";
import { BulkAttributeEditDialog } from "./BulkAttributeEditDialog";
import { EntityAttributeRow } from "./EntityAttributeRow";
import { EntityRelationshipsEditor } from "./EntityRelationshipsEditor";
import { derivePySourcePath, EntityTransformationsEditor } from "./EntityTransformationsEditor";
import { EntitySourcesEditor, type EntitySourcesEditorHandle } from "./EntitySourcesEditor";
import { applyBulkAttributeEditRules, getAttributeIdsInRange, type BulkAttributeEditRule } from "./bulkAttributeEdit";
import { buildAttributesFromExternalSourceSchema } from "./externalSchemaAdoption";
import { normalizeDataTypeForSave } from "../utils/sourceNormalization";
import { apiBase } from "../../../../../config";
import type {
  EntityAttribute,
  EntityPropertyRow,
  EntityReference,
  EntityRelationship,
  EntitySource,
  EntityTransformation,
} from "./types";

type EntityEditorProps = {
  selectedEntity: ModelEntity | null;
  mode: "form" | "json";
  setMode: React.Dispatch<React.SetStateAction<"form" | "json">>;
  entitySection: EntitySection;
  setEntitySection: React.Dispatch<React.SetStateAction<EntitySection>>;
  formState: { name?: string; displayName?: string; description?: string };
  setFormState: React.Dispatch<React.SetStateAction<{ name?: string; displayName?: string; description?: string }>>;
  jsonText: string;
  setJsonText: React.Dispatch<React.SetStateAction<string>>;
  setSaveError: React.Dispatch<React.SetStateAction<string | null>>;
  attributes: EntityAttribute[];
  setAttributes: React.Dispatch<React.SetStateAction<EntityAttribute[]>>;
  sources: EntitySource[];
  setSources: React.Dispatch<React.SetStateAction<EntitySource[]>>;
  relationships: EntityRelationship[];
  setRelationships: React.Dispatch<React.SetStateAction<EntityRelationship[]>>;
  transformations: EntityTransformation[];
  setTransformations: React.Dispatch<React.SetStateAction<EntityTransformation[]>>;
  properties: PropertyAssignment[];
  setProperties: React.Dispatch<React.SetStateAction<PropertyAssignment[]>>;
  openAttributeDetails: Record<string, boolean>;
  setOpenAttributeDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  openMappingDetails: Record<string, boolean>;
  setOpenMappingDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  collapsedMappings: Record<number, boolean>;
  setCollapsedMappings: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  relationshipZones: Record<number, string>;
  setRelationshipZones: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  openTransformSources: Record<number, boolean>;
  setOpenTransformSources: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  transformSourceCache: Record<number, string>;
  setTransformSourceCache: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  transformSourceDirty: Record<number, boolean>;
  setTransformSourceDirty: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  markEntityDirty: () => void;
  propertyOptions: PropertyOption[];
  entityPropertyRows: EntityPropertyRow[];
  entityInheritedProps?: { folderProps: PropertyAssignment[] };
  effectiveDataProduct?: string;
  effectiveDataModule?: string;
  zones: string[];
  zoneFromRelPath: (relPath: string | undefined) => string;
  modelEntities: ModelEntity[];
  resolveEntityMetaById: (id: unknown) => EntityReference | null;
  resolveEntityNameById: (id: unknown) => unknown;
  transformKinds: string[];
  normalizeTransformations: (list: EntityTransformation[]) => EntityTransformation[];
  updateTransformation: (idx: number, updater: (t: EntityTransformation) => EntityTransformation) => void;
  reorderTransformations: (from: number, to: number) => void;
  dragTransformIndex: React.MutableRefObject<number | null>;
  onJumpToEntity: (relPath: string) => void;
  onJumpToDataSource: (name: string) => void;
  dataTypes: string[];
  solutionPath: string;
  dataSourceOptions: string[];
  dataSourceDetails: Record<string, unknown>;
  attributeTypeOptions: { value: string; label: string }[];
  dataTypeDefinitions: Record<string, { hasCharLen?: boolean; hasPrecision?: boolean; hasScale?: boolean }>;
  onPatchBaseEntity: (relPath: string, updater: (content: unknown) => unknown) => void;
  dataSourcesRelPath: string | null;
  persistNow: (
    reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item" | "delete-item" | "undo-delete",
  ) => Promise<boolean>;
  persistAfterStateFlush: (
    reason: "text-blur" | "dropdown-change" | "tab-switch" | "add-item" | "delete-item" | "undo-delete",
  ) => void;
};

export const EntityEditor = (props: EntityEditorProps) => {
  const { selectedEntity, mode, setMode, entitySection, setEntitySection, formState, setFormState, jsonText, setJsonText, setSaveError, attributes, setAttributes, sources, setSources, relationships, setRelationships, transformations, setTransformations, properties, setProperties, openAttributeDetails, setOpenAttributeDetails, openMappingDetails, setOpenMappingDetails, collapsedMappings, setCollapsedMappings, relationshipZones, setRelationshipZones, openTransformSources, setOpenTransformSources, transformSourceCache, setTransformSourceCache, transformSourceDirty, setTransformSourceDirty, markEntityDirty, propertyOptions, dataSourceOptions, dataSourceDetails, entityPropertyRows, entityInheritedProps, effectiveDataProduct, effectiveDataModule, zones, zoneFromRelPath, modelEntities, resolveEntityMetaById, resolveEntityNameById, transformKinds, normalizeTransformations, updateTransformation, reorderTransformations, dragTransformIndex, onJumpToEntity, onJumpToDataSource, dataTypes, solutionPath, attributeTypeOptions, dataTypeDefinitions, onPatchBaseEntity, dataSourcesRelPath, persistNow, persistAfterStateFlush } = props;

  const inheritedFolderSet = useMemo(
    () => new Set((entityInheritedProps?.folderProps || []).map((p) => `${p?.property || ""}`).filter(Boolean)),
    [entityInheritedProps],
  );

  const entityPropertyChipItems = useMemo(
    (): PropertyChipItem[] =>
      entityPropertyRows
        .map((row, idx): PropertyChipItem | null => {
          const property = `${row?.item?.property ?? ""}`;
          if (!property.trim()) return null;
          const value = `${row?.item?.value ?? ""}`;
          const inherited = !!row?.inherited;
          const origin = inherited ? (inheritedFolderSet.has(property) ? "folder" : "inherited") : "entity";
          const title = origin === "folder" ? "Inherited from folder (add the same property to override)" : inherited ? "Inherited" : "Entity property";
          return {
            key: inherited ? `inherit-${property}-${idx}` : `entity-${row?.idx ?? idx}-${property}`,
            property,
            value,
            inherited,
            title,
            removeKey: inherited ? undefined : row?.idx,
          };
        })
        .filter((v): v is PropertyChipItem => v !== null),
    [entityPropertyRows, inheritedFolderSet],
  );

  const entityUsedLocalPropertyNames = useMemo(
    () => new Set((properties || []).map((p) => `${p?.property ?? ""}`).filter((p: string) => p.trim().length > 0)),
    [properties],
  );

  const addEntityProperty = (property: string, value: string) => {
    markEntityDirty();
    setProperties((prev) => [...(prev || []), { property, value }]);
    persistAfterStateFlush("add-item");
  };

  const removeEntityProperty = (idx: number | string) => {
    const index = typeof idx === "number" ? idx : Number(idx);
    if (!Number.isFinite(index)) return;
    markEntityDirty();
    setProperties((prev) => (prev || []).filter((_p, i: number) => i !== index));
    persistAfterStateFlush("delete-item");
  };

  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const nameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingScrollIndexRef = useRef<number | null>(null);
  const [dragAttrIndex, setDragAttrIndex] = useState<number | null>(null);
  const [dragOverState, setDragOverState] = useState<{ index: number; position: "before" | "after" } | null>(null);
  const [pendingFocusName, setPendingFocusName] = useState<string | null>(null);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const attributesRef = useRef<EntityAttribute[]>([]);
  const selectedAttributeIdsRef = useRef<Set<string>>(new Set());
  const dragAttrIndexRef = useRef<number | null>(null);

  const dataTypeOptions = useMemo(() => dataTypes.map((dt) => ({ value: dt, label: dt })), [dataTypes]);
  const attributeColumns = "0.4fr 1.4fr 0.95fr 0.46fr 0.7fr 0.78fr 1.56fr 0.6fr";
  const historyOptions = ["SCD0", "SCD1", "SCD2", "SCD3", "SCD4"];
  const expressionLanguageOptions = ["sql", "dax", "python"];
  const currentEntityAttributeNames = useMemo(
    () =>
      (attributes || [])
        .map((attr) => (typeof attr?.name === "string" ? attr.name : ""))
        .filter((name) => name.trim().length > 0),
    [attributes],
  );
  const selectedAttributes = useMemo(
    () =>
      attributes.filter((attribute) => attribute.__uiId && selectedAttributeIds.has(attribute.__uiId)),
    [attributes, selectedAttributeIds],
  );
  const isAttributeSelectionMode = selectedAttributeIds.size > 0;
  const selectableAttributeIds = useMemo(
    () =>
      attributes
        .map((attribute) => attribute.__uiId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    [attributes],
  );
  const areAllAttributesSelected = selectableAttributeIds.length > 0 && selectableAttributeIds.every((id) => selectedAttributeIds.has(id));
  const isPartiallySelected = selectedAttributeIds.size > 0 && !areAllAttributesSelected;

  const normalizeAttributeName = useCallback((value: string) => value.trim().toLowerCase(), []);
  const getUniqueAttributeName = (base: string) => {
    const existing = new Set(
      (attributes || [])
        .map((attr) => normalizeAttributeName(attr?.name || ""))
        .filter((name) => name.length > 0),
    );
    let candidate = base;
    let suffix = 1;
    while (existing.has(normalizeAttributeName(candidate))) {
      suffix += 1;
      candidate = `${base}_${suffix}`;
    }
    return candidate;
  };

  const makeUiId = useCallback(
    () =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `attr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    [],
  );

  const ensureAttrId = useCallback(
    (attr: EntityAttribute): EntityAttribute => (attr?.__uiId ? attr : { ...attr, __uiId: makeUiId() }),
    [makeUiId],
  );

  const withOrdinals = useCallback(
    (list: EntityAttribute[]) =>
      list.map((attr, idx) => {
        const hadId = !!attr.__uiId;
        const withId = hadId ? attr : ensureAttrId(attr);
        const newOrdinal = idx + 1;
        const ordinalChanged = withId.ordinalNumber !== newOrdinal;
        if (!ordinalChanged && hadId) return withId;
        if (!ordinalChanged) return withId; // only UI id added
        const modifiedFlag = !withId.__isNew ? true : withId.__modified;
        return { ...withId, ordinalNumber: newOrdinal, __modified: modifiedFlag };
      }),
    [ensureAttrId],
  );

  const updateAttributesStructural = useCallback(
    (updater: (list: EntityAttribute[]) => EntityAttribute[]) => {
      markEntityDirty();
      setAttributes((prev) => withOrdinals(updater(prev)));
    },
    [markEntityDirty, setAttributes, withOrdinals],
  );

  const updateAttributeAtNoOrdinals = useCallback(
    (index: number, updater: (attr: EntityAttribute) => EntityAttribute) => {
      markEntityDirty();
      setAttributes((prev) => {
        if (!prev[index]) return prev;
        const nextList = prev.slice();
        const patched = updater(prev[index]);
        if (patched === prev[index]) return prev;
        const finalAttr = !patched.__isNew ? { ...patched, __modified: patched.__modified || true } : patched;
        nextList[index] = finalAttr;
        return nextList;
      });
    },
    [markEntityDirty, setAttributes],
  );

  const removeAttribute = useCallback(
    (index: number, rowKey?: string) => {
      updateAttributesStructural((list) => list.filter((_item, i) => i !== index));
      setOpenAttributeDetails((prev) => {
        if (!rowKey) return prev;
        const next = { ...prev };
        delete next[rowKey];
        return next;
      });
    },
    [setOpenAttributeDetails, updateAttributesStructural],
  );

  const handleRemoveAttribute = useCallback(
    (index: number, rowKey?: string) => {
      removeAttribute(index, rowKey);
      persistAfterStateFlush("delete-item");
    },
    [persistAfterStateFlush, removeAttribute],
  );

  const reorderAttributes = useCallback(
    (from: number, to: number) => {
      updateAttributesStructural((list) => {
        const next = [...list];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      });
    },
    [updateAttributesStructural],
  );

  const toggleDetails = useCallback(
    (name: string) => setOpenAttributeDetails((prev) => ({ ...prev, [name]: !prev[name] })),
    [setOpenAttributeDetails],
  );

  const setRowRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    rowRefs.current[idx] = el;
  }, []);

  const setNameRef = useCallback((name: string, el: HTMLInputElement | null) => {
    if (!name) return;
    nameRefs.current[name] = el;
  }, []);

  const handleDragStart = useCallback((idx: number, e: React.DragEvent<HTMLButtonElement>) => {
    if (selectedAttributeIdsRef.current.size > 0) return;
    dragAttrIndexRef.current = idx;
    setDragAttrIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(idx));
  }, []);

  const handleDragEnd = useCallback(() => {
    dragAttrIndexRef.current = null;
    setDragAttrIndex(null);
    setDragOverState(null);
  }, []);

  const handleDragOverRow = useCallback(
    (idx: number, e: React.DragEvent<HTMLDivElement>) => {
      if (dragAttrIndexRef.current === null) return;
      e.preventDefault();
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
      setDragOverState({ index: idx, position });
    },
    [],
  );

  const handleDropRow = useCallback(
    (idx: number, position: "before" | "after") => {
      if (selectedAttributeIdsRef.current.size > 0) return;
      const from = dragAttrIndexRef.current;
      if (from === null) return;
      const baseTarget = position === "before" ? idx : idx + 1;
      const target = from < baseTarget ? baseTarget - 1 : baseTarget;
      reorderAttributes(from, target);
      persistAfterStateFlush("add-item");
      dragAttrIndexRef.current = null;
      setDragAttrIndex(null);
      setDragOverState(null);
    },
    [persistAfterStateFlush, reorderAttributes],
  );

  const handleDragLeaveRow = useCallback((idx: number) => {
    setDragOverState((prev) => (prev?.index === idx ? null : prev));
  }, []);

  const clearPendingFocus = useCallback(() => setPendingFocusName(null), []);
  const sourcesEditorRef = useRef<EntitySourcesEditorHandle | null>(null);
  const [adoptingSchemaIndex, setAdoptingSchemaIndex] = useState<number | null>(null);

  const adoptExternalSourceSchema = useCallback(
    (sourceIndex: number) => {
      const source = sources[sourceIndex];
      if (!source) return;

      const dataSourceName = typeof source?.dataSource === "string" ? source.dataSource : "";
      if (!dataSourceName) {
        window.alert("No data source configured on this source.");
        return;
      }

      const parseSourceLocation = (raw: string): { schema?: string; table: string } => {
        const value = `${raw || ""}`.trim();
        const bracket = value.match(/^\[(.+?)\]\.\[(.+?)\]$/);
        if (bracket) return { schema: bracket[1], table: bracket[2] };
        const dotParts = value.split(".");
        if (dotParts.length === 2) return { schema: dotParts[0].replace(/^\[|\]$/g, ""), table: dotParts[1].replace(/^\[|\]$/g, "") };
        return { table: value };
      };

      const applyColumns = (metaColumns: any[]) => {
        if (!metaColumns.length) {
          window.alert("No columns returned from the data source.");
          return;
        }

        const currentSourceNames = new Set(
          (Array.isArray(source.mapping) ? source.mapping : [])
            .map((m: any) => (typeof m?.sourceName === "string" ? m.sourceName.toLowerCase() : ""))
            .filter(Boolean),
        );
        const missingColumns = metaColumns.filter(
          (col: any) => typeof col?.name === "string" && !currentSourceNames.has(col.name.toLowerCase()),
        );

        if (!missingColumns.length) {
          window.alert("All source columns already have a mapping \u2014 nothing to restore.");
          return;
        }

        if (!window.confirm(`Restore ${missingColumns.length} missing mapping(s) from the source schema?`)) return;

        setSources((prev) =>
          prev.map((s, i) => {
            if (i !== sourceIndex) return s;
            const newMappings = missingColumns.map((col: any) => {
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
            });
            return { ...s, mapping: [...(s.mapping || []), ...newMappings] };
          }),
        );

        const dataSourceDetail = dataSourceName ? dataSourceDetails[dataSourceName] : undefined;
        const defaultAttributeType = attributeTypeOptions[0]?.value || "";
        const adoptedAttributes = buildAttributesFromExternalSourceSchema({
          source: { ...source, __uiExternalMeta: { columns: metaColumns } } as any,
          dataSourceDetail,
          canonicalDataTypes: dataTypes,
          defaultAttributeType,
        });
        const existingAttrNames = new Set(attributes.map((a) => (a.name || "").toLowerCase()));
        const missingColNames = new Set(missingColumns.map((c: any) => (c.name || "").toLowerCase()));
        const newAttributes = adoptedAttributes.filter(
          (a) => missingColNames.has((a.name || "").toLowerCase()) && !existingAttrNames.has((a.name || "").toLowerCase()),
        );
        if (newAttributes.length) {
          updateAttributesStructural((list) => [...list, ...newAttributes]);
        }

        persistAfterStateFlush("add-item");
      };

      // Use cached meta from the current session first.
      const uiMeta = source.__uiExternalMeta;
      const cachedColumns: any[] = Array.isArray(uiMeta?.columns) ? uiMeta.columns : [];
      if (cachedColumns.length) {
        applyColumns(cachedColumns);
        return;
      }

      // Fall back: fetch live from the backend.
      const rawLocation = typeof source.sourceLocation === "string" ? source.sourceLocation : "";
      if (!rawLocation) {
        window.alert("No source location configured. Set the data source and table location first.");
        return;
      }
      const { schema, table } = parseSourceLocation(rawLocation);
      if (!table) {
        window.alert("Could not parse source location. Set the data source and table location first.");
        return;
      }
      const endpoint = schema
        ? `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}`
        : `${apiBase}/sources/${encodeURIComponent(dataSourceName)}/tables/${encodeURIComponent(table)}`;

      setAdoptingSchemaIndex(sourceIndex);
      fetch(endpoint)
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) {
            const msg = typeof data?.message === "string" ? data.message : "Failed to fetch schema from data source.";
            window.alert(msg);
            return;
          }
          const rawColumns = Array.isArray(data?.items) ? data.items : [];
          const metaColumns = rawColumns.map((col: any) => ({
            name: `${col?.name || ""}`,
            ordinal: Number(col?.ordinal || 0),
            dataType: `${col?.dataType || ""}`,
            maxLength: typeof col?.maxLength === "number" ? col.maxLength : null,
            numericPrecision: typeof col?.numericPrecision === "number" ? col.numericPrecision : null,
            numericScale: typeof col?.numericScale === "number" ? col.numericScale : null,
            isNullable: Boolean(col?.isNullable),
            isPrimaryKey: Boolean(col?.isPrimaryKey),
          }));
          applyColumns(metaColumns);
        })
        .catch((err) => {
          window.alert(`Failed to fetch schema: ${err?.message || err}`);
        })
        .finally(() => {
          setAdoptingSchemaIndex(null);
        });
    },
    [
      sources,
      setSources,
      dataSourceDetails,
      attributeTypeOptions,
      dataTypes,
      attributes,
      updateAttributesStructural,
      persistAfterStateFlush,
    ],
  );

  useEffect(() => {
    const onSelectChanged = () => persistAfterStateFlush("dropdown-change");
    const onCheckboxChanged = () => persistAfterStateFlush("add-item");
    const onValueCommitted = () => persistAfterStateFlush("add-item");
    window.addEventListener("dm8:form-select-change", onSelectChanged as EventListener);
    window.addEventListener("dm8:checkbox-change", onCheckboxChanged as EventListener);
    window.addEventListener("dm8:value-commit", onValueCommitted as EventListener);
    return () => {
      window.removeEventListener("dm8:form-select-change", onSelectChanged as EventListener);
      window.removeEventListener("dm8:checkbox-change", onCheckboxChanged as EventListener);
      window.removeEventListener("dm8:value-commit", onValueCommitted as EventListener);
    };
  }, [persistAfterStateFlush]);

  const handleTextFieldBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target instanceof HTMLInputElement) {
        const blocked = new Set(["checkbox", "radio", "button", "submit", "reset", "file", "hidden", "color", "range"]);
        if (blocked.has((target.type || "").toLowerCase())) return;
      }
      void persistNow("text-blur");
    },
    [persistNow],
  );

  const commitRename = useCallback(
    (index: number, oldName: string, draftValue: string): string | null => {
      const newName = draftValue.trim();
      if (!oldName) return null;
      const normalizedNew = normalizeAttributeName(newName);
      const normalizedOld = normalizeAttributeName(oldName);
      if (!newName) return "Name cannot be empty.";
      const hasDuplicate = attributesRef.current.some(
        (a, idx) => idx !== index && normalizeAttributeName(a?.name || "") === normalizedNew,
      );
      if (hasDuplicate) return "Name must be unique.";
      if (normalizedNew === normalizedOld) return null;

      updateAttributeAtNoOrdinals(index, (attr) => {
        if (attr?.name !== oldName) return attr;
        const next: EntityAttribute = { ...attr, name: newName };
        if (!attr.__isNew) {
          next.__modified = true;
          const refactorNames = Array.isArray(attr.refactorNames) ? [...attr.refactorNames] : [];
          if (!refactorNames.includes(oldName)) {
            refactorNames.push(oldName);
          }
          next.refactorNames = refactorNames;
        }
        return next;
      });

      setOpenAttributeDetails((prev) => {
        const next = { ...prev };
        if (prev[oldName]) {
          delete next[oldName];
          next[newName] = true;
        }
        return next;
      });
      setPendingFocusName(newName);
      return null;
    },
    [normalizeAttributeName, setOpenAttributeDetails, updateAttributeAtNoOrdinals],
  );

  useEffect(() => {
    if (pendingScrollIndexRef.current !== null) {
      const idx = pendingScrollIndexRef.current;
      requestAnimationFrame(() => {
        rowRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
        const rowName = attributesRef.current[idx]?.name;
        const input = rowName ? nameRefs.current[rowName] : null;
        if (input) {
          input.focus();
          input.select();
        }
      });
      pendingScrollIndexRef.current = null;
    }
  }, [attributes.length]);

  useEffect(() => {
    if (attributes.some((a) => !a?.__uiId)) {
      setAttributes((list) => withOrdinals(list));
    }
  }, [attributes]);

  useEffect(() => {
    attributesRef.current = attributes;
  }, [attributes]);

  useEffect(() => {
    selectedAttributeIdsRef.current = selectedAttributeIds;
  }, [selectedAttributeIds]);

  useEffect(() => {
    const validIds = new Set(
      attributes.map((attribute) => attribute.__uiId).filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    setSelectedAttributeIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === prev.size && Array.from(next).every((id) => prev.has(id))) return prev;
      return next;
    });
    setSelectionAnchorId((prev) => (prev && validIds.has(prev) ? prev : null));
  }, [attributes]);

  useEffect(() => {
    if (mode !== "form") {
      setMode("form");
    }
  }, [mode, setMode]);

  useEffect(() => {
    setSelectedAttributeIds(new Set());
    selectedAttributeIdsRef.current = new Set();
    setSelectionAnchorId(null);
    setBulkEditOpen(false);
  }, [selectedEntity?.relPath]);

  const clearAttributeSelection = useCallback(() => {
    setSelectedAttributeIds(new Set());
    selectedAttributeIdsRef.current = new Set();
    setSelectionAnchorId(null);
  }, []);

  const handleToggleSelectAllAttributes = useCallback(() => {
    if (areAllAttributesSelected || selectableAttributeIds.length === 0) {
      clearAttributeSelection();
      return;
    }
    const nextSelection = new Set(selectableAttributeIds);
    selectedAttributeIdsRef.current = nextSelection;
    setSelectedAttributeIds(nextSelection);
    setSelectionAnchorId(selectableAttributeIds[0] ?? null);
  }, [areAllAttributesSelected, clearAttributeSelection, selectableAttributeIds]);

  const handleSelectAttribute = useCallback(
    (index: number, event: React.MouseEvent<HTMLElement>) => {
      const clickedId = attributesRef.current[index]?.__uiId;
      if (!clickedId) return;
      const currentSelection = selectedAttributeIdsRef.current;
      const nextSelection = new Set(currentSelection);

      if (event.shiftKey) {
        const rangeIds = getAttributeIdsInRange(attributesRef.current, selectionAnchorId || clickedId, clickedId);
        if (event.metaKey || event.ctrlKey) {
          rangeIds.forEach((id) => nextSelection.add(id));
        } else {
          nextSelection.clear();
          rangeIds.forEach((id) => nextSelection.add(id));
        }
      } else if (event.metaKey || event.ctrlKey || currentSelection.size > 0) {
        if (nextSelection.has(clickedId)) {
          nextSelection.delete(clickedId);
        } else {
          nextSelection.add(clickedId);
        }
      } else {
        nextSelection.clear();
        nextSelection.add(clickedId);
      }

      selectedAttributeIdsRef.current = nextSelection;
      setSelectedAttributeIds(nextSelection);
      setSelectionAnchorId(nextSelection.size === 0 ? null : event.shiftKey ? selectionAnchorId || clickedId : clickedId);
    },
    [selectionAnchorId],
  );

  const handleApplyBulkEdits = useCallback(
    (rules: BulkAttributeEditRule[]) => {
      const selectedIds = new Set(selectedAttributeIdsRef.current);
      if (selectedIds.size === 0 || rules.length === 0) return;
      let didChange = false;
      setAttributes((prev) => {
        const next = applyBulkAttributeEditRules(prev, selectedIds, rules);
        didChange = next.some((attribute, index) => attribute !== prev[index]);
        return didChange ? next : prev;
      });
      if (!didChange) return;
      markEntityDirty();
      persistAfterStateFlush("dropdown-change");
    },
    [markEntityDirty, persistAfterStateFlush, setAttributes],
  );

  if (!selectedEntity) return <div className="muted">Select an entity to view.</div>;
  const effectiveProduct = typeof effectiveDataProduct === "string" ? effectiveDataProduct.trim() : "";
  const effectiveModule = typeof effectiveDataModule === "string" ? effectiveDataModule.trim() : "";

  return (
    <div className="panel">
      <EditorPanelHeader
        eyebrow={selectedEntity.relPath}
        title={
          <div className="panel__title-row">
            <span className="panel__title-text panel__title-text--entity">{selectedEntity.name}</span>
          </div>
        }
        meta={
          <PropertyChips
            className="panel__chips chips--sm"
            items={entityPropertyChipItems}
            propertyOptions={propertyOptions}
            usedPropertyNames={entityUsedLocalPropertyNames}
            onAdd={addEntityProperty}
            onRemove={removeEntityProperty}
            addLabel="Add property"
          />
        }
        actions={
          (effectiveProduct || effectiveModule) ? (
            <div className="panel__entity-title-actions">
              <div className="panel__title-meta-rail">
                {effectiveProduct ? (
                  <div className="panel__title-label panel__title-label--product">
                    <span className="panel__title-label-key">Product</span>
                    <span className="panel__title-label-value">{effectiveProduct}</span>
                  </div>
                ) : null}
                {effectiveModule ? (
                  <div className="panel__title-label panel__title-label--module">
                    <span className="panel__title-label-key">Module</span>
                    <span className="panel__title-label-value">{effectiveModule}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null
        }
      />
        <div className="panel__body panel__body--entity-editor" onBlurCapture={handleTextFieldBlurCapture}>
          {mode === "form" ? (
            <>
              <div className="section-nav-row entity-section-nav-row">
                <div className="section-nav">
                  {(["overview", "attributes", "sources", "relationships", "transformations"] as EntitySection[]).map((sec) => (
                    <button
                      key={sec}
                      className={`section-nav__btn ${entitySection === sec ? "section-nav__btn--active" : ""}`}
                      onClick={() => {
                        if (sec === entitySection) return;
                        void (async () => {
                          const canSwitch = await persistNow("tab-switch");
                          if (!canSwitch) return;
                          setEntitySection(sec);
                        })();
                      }}
                    >
                      {sec.charAt(0).toUpperCase() + sec.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="section-nav-actions">
                  {entitySection === "attributes" ? (
                    <>
                      <ActionButton
                        variant="default"
                        onClick={() => {
                          if (isAttributeSelectionMode) {
                            setBulkEditOpen(true);
                            return;
                          }
                          const defaultType = dataTypeOptions[0]?.value || "string";
                          const defaultAttrType = attributeTypeOptions[0]?.value || "";
                          const nowIso = new Date().toISOString();
                          const uniqueName = getUniqueAttributeName("new_column");
                          pendingScrollIndexRef.current = attributes.length;
                          updateAttributesStructural((list) => [
                            ...list,
                            {
                              name: uniqueName,
                              attributeType: defaultAttrType,
                              dataType: { type: defaultType, nullable: true },
                              __uiId: makeUiId(),
                              __isNew: true,
                              __modified: true,
                              dateAdded: nowIso,
                              properties: [],
                            },
                          ]);
                          persistAfterStateFlush("add-item");
                        }}
                      >
                        {isAttributeSelectionMode ? "Bulk Edit" : "Add Attribute"}
                      </ActionButton>
                      {isAttributeSelectionMode ? (
                        <IconBtn
                          title="Clear selection"
                          aria-label="Clear selection"
                          onClick={clearAttributeSelection}
                          className="entity-attributes__clear-selection"
                        >
                          <X className="h-4 w-4" />
                        </IconBtn>
                      ) : null}
                    </>
                  ) : null}
                  {entitySection === "sources" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton variant="default">
                          Add source <ChevronDown className="h-4 w-4" />
                        </ActionButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          sourcesEditorRef.current?.addInternalSource();
                          persistAfterStateFlush("add-item");
                        }}>
                          Internal source
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          sourcesEditorRef.current?.addExternalSource();
                          persistAfterStateFlush("add-item");
                        }}>
                          External source
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  {entitySection === "relationships" ? (
                    <ActionButton
                      variant="default"
                      onClick={() => {
                        markEntityDirty();
                        setRelationships((list) => [...list, { targetModelEntityId: null, name: `Rel${list.length + 1}` }]);
                        persistAfterStateFlush("add-item");
                      }}
                    >
                      Add Relationship
                    </ActionButton>
                  ) : null}
                  {entitySection === "transformations" ? (
                    <ActionButton
                      variant="default"
                      onClick={() => {
                        markEntityDirty();
                        setTransformations((list) => {
                          const name = `Step${list.length + 1}`;
                          const kind = transformKinds[0];
                          const next: EntityTransformation = { name, kind };
                          if (kind === "function") {
                            const source = derivePySourcePath(name);
                            next.function = { source };
                            next.__uiPrevFunctionSource = source;
                          }
                          return normalizeTransformations([...list, next]);
                        });
                        persistAfterStateFlush("add-item");
                      }}
                    >
                      Add Step
                    </ActionButton>
                  ) : null}
                </div>
              </div>
              {entitySection === "overview" && (
                <div className="stack">
                  <div className="form-shell form-shell--identity entity-overview-shell">
                    <div className="form-grid">
                      <div>
                        <label>Name</label>
                        <input
                          placeholder="Entity name"
                          value={formState.name || ""}
                          onChange={(e) => {
                            markEntityDirty();
                            setFormState((s) => ({ ...s, name: e.target.value }));
                          }}
                        />
                      </div>
                      <div>
                        <label>Display Name</label>
                        <input
                          placeholder="Display name"
                          value={formState.displayName || ""}
                          onChange={(e) => {
                            markEntityDirty();
                            setFormState((s) => ({ ...s, displayName: e.target.value }));
                          }}
                        />
                      </div>
                      <div className="full">
                        <label>Description</label>
                        <Textarea
                          rows={4}
                          placeholder="Describe this entity"
                          value={formState.description || ""}
                          onChange={(e) => {
                            markEntityDirty();
                            setFormState((s) => ({ ...s, description: e.target.value }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {entitySection === "attributes" && (
                <div>
                  <div className="table entity-attributes-table">
                    <div className="value-row">
                      <div className="table-row table-head" style={{ gridTemplateColumns: attributeColumns }}>
                        <div>
                          <IconBtn
                            type="button"
                            title={areAllAttributesSelected ? "Clear all selected attributes" : "Select all attributes"}
                            aria-label={areAllAttributesSelected ? "Clear all selected attributes" : "Select all attributes"}
                            onClick={handleToggleSelectAllAttributes}
                            className={`attribute-row__selector attribute-row__selector--header ${
                              areAllAttributesSelected ? "attribute-row__selector--selected" : ""
                            } ${isPartiallySelected ? "attribute-row__selector--partial" : ""}`}
                          >
                            {areAllAttributesSelected ? (
                              <Check strokeWidth={3} className="h-3.5 w-3.5" />
                            ) : isPartiallySelected ? (
                              <Minus strokeWidth={3} className="h-3.5 w-3.5" />
                            ) : (
                              <Check strokeWidth={3} className="h-3.5 w-3.5 attribute-row__selector-icon--hidden" />
                            )}
                          </IconBtn>
                        </div>
                        <div>Name</div>
                        <div>Data Type</div>
                        <div className="boolean-cell">Nullable</div>
                        <div className="boolean-cell">Business Key</div>
                        <div>History</div>
                        <div>Column Properties</div>
                        <div>Actions</div>
                      </div>
                    </div>
                    {attributes.map((attr, idx) => {
                      const rowKey = attr?.name || "";
                      const detailsOpen = !!openAttributeDetails[rowKey];
                      const dropClass =
                        dragOverState?.index === idx && dragAttrIndexRef.current !== null
                          ? dragOverState.position === "before"
                            ? "row--drop-before"
                            : "row--drop-after"
                          : "";
                      return (
                        <EntityAttributeRow
                          key={attr.__uiId || `${rowKey}-${idx}`}
                          attr={attr}
                          index={idx}
                          detailsOpen={detailsOpen}
                          dropClass={dropClass}
                          isSelected={!!(attr.__uiId && selectedAttributeIds.has(attr.__uiId))}
                          showSelectionUi={isAttributeSelectionMode}
                          attributeColumns={attributeColumns}
                          dataTypeOptions={dataTypeOptions}
                          attributeTypeOptions={attributeTypeOptions}
                          propertyOptions={propertyOptions}
                          dataTypeDefinitions={dataTypeDefinitions}
                          historyOptions={historyOptions}
                          expressionLanguageOptions={expressionLanguageOptions}
                          onPatch={updateAttributeAtNoOrdinals}
                          onToggleDetails={toggleDetails}
                          onRemove={handleRemoveAttribute}
                          onCommitRename={commitRename}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOverRow}
                          onDrop={handleDropRow}
                          onDragLeave={handleDragLeaveRow}
                          onSelect={handleSelectAttribute}
                          rowRef={setRowRef}
                          nameRef={setNameRef}
                          pendingFocus={pendingFocusName === rowKey}
                          clearPendingFocus={clearPendingFocus}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              {entitySection === "sources" && (
                <EntitySourcesEditor
                  ref={sourcesEditorRef}
                  sources={sources}
                  setSources={setSources}
                  propertyOptions={propertyOptions}
                  collapsedMappings={collapsedMappings}
                  setCollapsedMappings={setCollapsedMappings}
                  openMappingDetails={openMappingDetails}
                  setOpenMappingDetails={setOpenMappingDetails}
                  zones={zones}
                  modelEntities={modelEntities}
                  resolveEntityMetaById={resolveEntityMetaById}
                  onJumpToEntity={onJumpToEntity}
                  onJumpToDataSource={onJumpToDataSource}
                  markEntityDirty={markEntityDirty}
                  dataSourceOptions={dataSourceOptions}
                  dataSourceDetails={dataSourceDetails}
                  adoptingExternalSchemaIndex={adoptingSchemaIndex}
                  solutionPath={solutionPath}
                  onPatchBaseEntity={onPatchBaseEntity}
                  dataSourcesRelPath={dataSourcesRelPath}
                  currentEntityAttributeNames={currentEntityAttributeNames}
                  onAdoptExternalSourceSchema={adoptExternalSourceSchema}
                  onDeleteSource={() => persistAfterStateFlush("delete-item")}
                  onMappingChange={() => persistAfterStateFlush("delete-item")}
                  onSourcePropertyChange={() => persistAfterStateFlush("delete-item")}
                />
              )}
              {entitySection === "relationships" && (
                <EntityRelationshipsEditor
                  relationships={relationships}
                  setRelationships={setRelationships}
                  relationshipZones={relationshipZones}
                  setRelationshipZones={setRelationshipZones}
                  modelEntities={modelEntities}
                  zones={zones}
                  attributes={attributes}
                  resolveEntityNameById={resolveEntityNameById}
                  zoneFromRelPath={zoneFromRelPath}
                  onJumpToEntity={onJumpToEntity}
                  markEntityDirty={markEntityDirty}
                  onDeleteRelationship={() => persistAfterStateFlush("delete-item")}
                />
              )}
              {entitySection === "transformations" && (
                <EntityTransformationsEditor
                  transformations={transformations}
                  transformKinds={transformKinds}
                  openTransformSources={openTransformSources}
                  transformSourceCache={transformSourceCache}
                  transformSourceDirty={transformSourceDirty}
                  dragTransformIndex={dragTransformIndex}
                  normalizeTransformations={normalizeTransformations}
                  updateTransformation={updateTransformation}
                  reorderTransformations={reorderTransformations}
                  setTransformations={setTransformations}
                  setOpenTransformSources={setOpenTransformSources}
                  setTransformSourceCache={setTransformSourceCache}
                  setTransformSourceDirty={setTransformSourceDirty}
                  setSaveError={setSaveError}
                  markEntityDirty={markEntityDirty}
                  selectedEntity={selectedEntity}
                  entityName={String(formState?.name || selectedEntity?.content?.name || selectedEntity?.name || "")}
                  solutionPath={solutionPath}
                  onDeleteTransformation={() => persistAfterStateFlush("delete-item")}
                />
              )}
            </>
          ) : (
            <div>
              <label>JSON</label>
              <Textarea
                rows={20}
                className="code"
                value={jsonText}
                onChange={(e) => {
                  markEntityDirty();
                  setJsonText(e.target.value);
                }}
              />
            </div>
          )}
        </div>
        <BulkAttributeEditDialog
          open={bulkEditOpen}
          onOpenChange={setBulkEditOpen}
          selectedAttributes={selectedAttributes}
          dataTypeOptions={dataTypeOptions}
          attributeTypeOptions={attributeTypeOptions}
          historyOptions={historyOptions}
          expressionLanguageOptions={expressionLanguageOptions}
          propertyOptions={propertyOptions}
          onApply={handleApplyBulkEdits}
        />
      </div>
    );
};
