import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "@datam8/ui";
import type { EntitySection, ModelEntity, PropertyOption } from "../../../model-types";
import { mergeInheritedProps } from "../../../model-utils";
import { normalizeMappingForSave, normalizePropertiesForSave } from "../utils/sourceNormalization";
import { deepEqual } from "../../../../../shared/utils/deepEqual";
import { useSaveFailureToast } from "../../../../../shared/ui/useSaveFailureToast";
import { reindexRecordAfterMove } from "./transformationSourceMaps";
import { saveFunctionSource } from "../../../../../shared/desktop/functionSourceBridge";
import { resolveQueuedPersistAfterSave } from "./autosaveScheduling";

const cloneDeep = <T,>(value: T): T => JSON.parse(JSON.stringify(value ?? null));
const asNonEmptyString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizePropertyAssignments = (value: unknown): Array<{ property: string; value: string }> =>
  (Array.isArray(value) ? value : [])
    .map((item: any) => ({
      property: asNonEmptyString(item?.property),
      value: `${item?.value ?? ""}`.trim(),
    }))
    .filter((item) => item.property.length > 0);

export const normalizeOptionalStringField = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

export const isValidInternalSourceLocation = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
};

export const serializeEntityContent = ({
  baseContent,
  formValues,
  attributes,
  sources,
  relationships,
  transformations,
  properties,
}: {
  baseContent: any;
  formValues: { name?: string; displayName?: string; description?: string };
  attributes: any[];
  sources: any[];
  relationships: any[];
  transformations: any[];
  properties: any[];
}) => {
  const serializedRelationships = (relationships || []).map((rel: any) => ({
    targetLocation: rel.targetModelEntityId ?? rel.targetLocation ?? null,
    attributes: (rel.mappings || []).map((m: any) => ({
      sourceName: m.source,
      targetName: m.target,
    })),
  }));
  const serializedTransforms = (transformations || []).map((t, i) => {
    const base = { ...t, stepNo: i + 1 };
    delete (base as any).__uiPrevFunctionSource;
    if (base.kind === "function") {
      base.function = { source: base.function?.source || `${base.name || "function"}.py` };
    } else {
      delete base.function;
    }
    return base;
  });
  const next: any = {
    ...baseContent,
    attributes,
    sources,
    relationships: serializedRelationships,
    transformations: serializedTransforms,
    properties,
  };
  // effectiveProperties is read-only projection from /solution/full and must never be persisted.
  delete next.effectiveProperties;
  const name = formValues.name ?? baseContent?.name;
  const displayName = formValues.displayName ?? baseContent?.displayName;
  const description = formValues.description ?? baseContent?.description;
  if (name !== undefined) next.name = name;
  if (displayName !== undefined) next.displayName = displayName;
  if (description !== undefined) next.description = description;
  else delete next.description;
  return next;
};

export const normalizeRelationshipsForSave = (relationships: any[] | undefined) =>
  (relationships || [])
    .map((rel: any) => {
      const targetModelEntityId = rel?.targetModelEntityId ?? rel?.targetLocation ?? null;
      const mappings = (rel?.mappings || [])
        .map((m: any) => ({
          source: asNonEmptyString(m?.source),
          target: asNonEmptyString(m?.target),
        }))
        .filter((m: any) => m.source && m.target);
      if (targetModelEntityId === null || targetModelEntityId === undefined) return null;
      if (!mappings.length) return null;
      return {
        ...rel,
        targetModelEntityId,
        mappings,
      };
    })
    .filter((rel: any) => rel !== null);

export const normalizeSourcesForSave = (list: any[] | undefined) =>
  (list || [])
    .map((src) => {
      const isExternal = Object.prototype.hasOwnProperty.call(src ?? {}, "dataSource") || src?.type === "external";
      const mapping = normalizeMappingForSave(src?.mapping).filter((item: any) => {
        const sourceName = asNonEmptyString(item?.sourceName);
        const targetName = asNonEmptyString(item?.targetName);
        return sourceName.length > 0 && targetName.length > 0;
      });
      const properties = normalizePropertiesForSave(src?.properties);
      if (isExternal) {
        const dataSource = asNonEmptyString(src?.dataSource);
        const sourceLocation = src?.sourceLocation;
        if (!dataSource || !isValidInternalSourceLocation(sourceLocation)) return null;
        const out: any = {};
        out.dataSource = dataSource;
        if (src?.sourceAlias) out.sourceAlias = src.sourceAlias;
        out.sourceLocation = sourceLocation;
        if (properties.length) out.properties = properties;
        if (mapping.length) out.mapping = mapping;
        return out;
      }
      if (!isValidInternalSourceLocation(src?.sourceLocation)) return null;
      const out: any = {};
      out.sourceLocation = src?.sourceLocation;
      if (properties.length) out.properties = properties;
      if (mapping.length) out.mapping = mapping;
      return out;
    })
    .filter((src) => src !== null);

export const resetAttributeSaveMarkers = <T extends { __isNew?: boolean; __modified?: boolean }>(attributes: T[]): T[] =>
  attributes.map((attr) => {
    if (!attr?.__isNew && !attr?.__modified) return attr;
    return {
      ...attr,
      __isNew: false,
      __modified: false,
    };
  });

export type EntityEditorDraft = {
  mode: "form" | "json";
  entitySection: EntitySection;
  formState: { name?: string; displayName?: string; description?: string };
  jsonText: string;
  attributes: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  relationships: Record<string, unknown>[];
  transformations: Record<string, unknown>[];
  properties: Record<string, unknown>[];
  openAttributeDetails: Record<string, boolean>;
  openMappingDetails: Record<string, boolean>;
  collapsedMappings: Record<number, boolean>;
  relationshipZones: Record<number, string>;
  openTransformSources: Record<number, boolean>;
  transformSourceCache: Record<number, string>;
  transformSourceDirty: Record<number, boolean>;
};

type EntityStateParams = {
  selectedEntity: ModelEntity | null;
  modelEntities: ModelEntity[];
  entityInheritedProps?: { folderProps: any[] };
  effectiveDataProduct?: string;
  effectiveDataModule?: string;
  propertyOptions: PropertyOption[];
  dataTypes: string[];
  solutionPath: string;
  attributeTypeOptions: { value: string; label: string }[];
  dataTypeDefinitions: Record<string, { hasCharLen?: boolean; hasPrecision?: boolean; hasScale?: boolean }>;
  dataSourceDetails: Record<string, any>;
  dataSourcesRelPath: string | null;
  onDirtyEntity: (relPath: string, dirty: boolean) => void;
  onSave: (updated: ModelEntity) => Promise<void>;
  onJumpToEntity: (relPath: string) => void;
  onJumpToDataSource: (name: string) => void;
  dataSourceOptions: string[];
  onPatchBaseEntity: (relPath: string, updater: (content: any) => any) => void;
  getEntityDraft: (relPath: string) => EntityEditorDraft | null;
  setEntityDraft: (relPath: string, draft: EntityEditorDraft | null) => void;
};

type PersistReason =
  | "text-blur"
  | "dropdown-change"
  | "tab-switch"
  | "add-item"
  | "delete-item"
  | "undo-delete";

export const useEntityState = ({
  selectedEntity,
  modelEntities,
  entityInheritedProps,
  effectiveDataProduct,
  effectiveDataModule,
  propertyOptions,
  dataTypes,
  dataSourceOptions,
  attributeTypeOptions,
  dataTypeDefinitions,
  solutionPath,
  dataSourceDetails,
  dataSourcesRelPath,
  onDirtyEntity,
  onSave,
  onJumpToEntity,
  onJumpToDataSource,
  onPatchBaseEntity,
  getEntityDraft,
  setEntityDraft,
}: EntityStateParams) => {
  const originalRef = useRef<any | null>(null);
  const originalRelRef = useRef<string | null>(null);
  const pendingSelfSaveAckRelPathRef = useRef<string | null>(null);
  const baselineReadyRef = useRef<boolean>(false);
  const skipNextDirtyRef = useRef<boolean>(false);
  const hydratingRef = useRef<boolean>(false);
  const hydrationFrameRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [formState, setFormState] = useState<{ name?: string; displayName?: string; description?: string }>({});
  const [jsonText, setJsonText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error" | "success">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [entitySection, setEntitySection] = useState<EntitySection>("overview");
  const [attributes, setAttributes] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [transformations, setTransformations] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [openAttributeDetails, setOpenAttributeDetails] = useState<Record<string, boolean>>({});
  const [openMappingDetails, setOpenMappingDetails] = useState<Record<string, boolean>>({});
  const [collapsedMappings, setCollapsedMappings] = useState<Record<number, boolean>>({});
  const [relationshipZones, setRelationshipZones] = useState<Record<number, string>>({});
  const [openTransformSources, setOpenTransformSources] = useState<Record<number, boolean>>({});
  const dragTransformIndex = useRef<number | null>(null);
  const [transformSourceCache, setTransformSourceCache] = useState<Record<number, string>>({});
  const [transformSourceDirty, setTransformSourceDirty] = useState<Record<number, boolean>>({});
  const entityDirtyRef = useRef(false);
  const persistInFlightRef = useRef(false);
  const persistQueuedRef = useRef(false);
  const pendingPersistReasonRef = useRef<PersistReason | null>(null);
  const pendingPersistRevisionRef = useRef(0);
  const changeRevisionRef = useRef(0);
  const [changeRevision, setChangeRevision] = useState(0);
  const [persistRequestTick, setPersistRequestTick] = useState(0);

  const bumpChangeRevision = useCallback(() => {
    const next = changeRevisionRef.current + 1;
    changeRevisionRef.current = next;
    setChangeRevision(next);
  }, []);

  const markEntityDirty = useCallback(() => {
    entityDirtyRef.current = true;
    bumpChangeRevision();
  }, [bumpChangeRevision]);

  const mergedEntityInheritedProps = useMemo(
    () => {
      const localProperties = normalizePropertyAssignments(properties);
      const effectiveProperties = normalizePropertyAssignments(selectedEntity?.content?.effectiveProperties);
      if (effectiveProperties.length > 0) {
        const localKeys = new Set(localProperties.map((item) => `${item.property}::${item.value}`));
        return effectiveProperties.filter((item) => !localKeys.has(`${item.property}::${item.value}`));
      }
      return mergeInheritedProps(entityInheritedProps?.folderProps || [], [], localProperties);
    },
    [entityInheritedProps, properties, selectedEntity?.content?.effectiveProperties],
  );

  const entityPropertyRows = useMemo(
    () => [
      ...(mergedEntityInheritedProps || []).map((p: any) => ({ item: p, inherited: true })),
      ...normalizePropertyAssignments(properties).map((p: any, idx: number) => ({ item: p, inherited: false, idx })),
    ],
    [mergedEntityInheritedProps, properties],
  );

  const zoneFromRelPath = useCallback((relPath: string | undefined) => {
    if (!relPath) return "";
    const parts = relPath.split("/");
    return parts[1] || "";
  }, []);

  const zones = useMemo(
    () => Array.from(new Set(modelEntities.map((m) => zoneFromRelPath(m.relPath)).filter(Boolean))),
    [modelEntities, zoneFromRelPath],
  );

  const transformKinds = useMemo(() => ["builtin", "function"], []);

  const resolveEntityMetaById = useCallback(
    (id: any) => {
      const found = modelEntities.find((m) => m.content?.id === id);
      if (!found) return null;
      const parts = (found.relPath || "").split("/");
      return {
        name: found.name,
        relPath: found.relPath,
        zone: parts[1],
      };
    },
    [modelEntities],
  );

  const resolveEntityNameById = useCallback(
    (id: any) => {
      const found = modelEntities.find((m) => m.content?.id === id);
      return found ? found.name : id;
    },
    [modelEntities],
  );

  const inferSourceType = useCallback((src: any) => {
    if (src?.type === "external" || src?.type === "internal") return src.type;
    return src && Object.prototype.hasOwnProperty.call(src, "dataSource") ? "external" : "internal";
  }, []);

  const resolveInternalMeta = useCallback(
    (src: any) => {
      if (!src) return null;
      const loc = src.sourceLocation;
      const internalTargetId =
        typeof loc === "number" ? loc : typeof loc === "string" && /^\d+$/.test(loc.trim()) ? Number(loc.trim()) : null;
      const metaById = internalTargetId ? resolveEntityMetaById(internalTargetId) : null;
      if (metaById) return metaById;
      const zone = src.zone;
      const name = src.name;
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
    },
    [modelEntities, resolveEntityMetaById],
  );

  const normalizeTransformations = useCallback(
    (list: any[]) =>
      (list || []).map((t: any, i: number) => {
        const next: any = { ...t, stepNo: i + 1 };
        if (next.kind === "function" && next.function?.source && !next.__uiPrevFunctionSource) {
          next.__uiPrevFunctionSource = next.function.source;
        }
        if (next.kind !== "function") {
          delete next.__uiPrevFunctionSource;
        }
        return next;
      }),
    [],
  );

  const scheduleHydrationRelease = useCallback(() => {
    if (typeof window === "undefined") {
      hydratingRef.current = false;
      return;
    }
    if (hydrationFrameRef.current !== null) {
      window.cancelAnimationFrame(hydrationFrameRef.current);
    }
    hydrationFrameRef.current = window.requestAnimationFrame(() => {
      hydratingRef.current = false;
      hydrationFrameRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && hydrationFrameRef.current !== null) {
        window.cancelAnimationFrame(hydrationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    entityDirtyRef.current = false;
    persistQueuedRef.current = false;
    pendingPersistReasonRef.current = null;
    pendingPersistRevisionRef.current = 0;
    changeRevisionRef.current = 0;
    setChangeRevision(0);
  }, [selectedEntity?.relPath]);

  const normalizeAttributes = useCallback(
    (list: any[], opts?: { forSave?: boolean }) => {
      const forSave = opts?.forSave ?? false;
      const defaultAttrType = attributeTypeOptions?.[0]?.value || "";
      const defaultDataType = dataTypes?.[0] || "string";
      const now = forSave ? new Date().toISOString() : null;
      return (list || []).map((attr: any, idx: number) => {
        if (!forSave) {
          const out: any = { ...attr };
          delete out.__uiId;
          delete out.__isNew;
          delete out.__modified;
          return out;
        }

        const dataType = attr?.dataType || {};
        const normalizeNumeric = (val: any) => {
          if (val === null || val === undefined || val === "") return undefined;
          const num = Number(val);
          return Number.isFinite(num) ? num : undefined;
        };
        const normalizedDataType: any = {};
        normalizedDataType.type = dataType.type || defaultDataType;
        normalizedDataType.nullable = dataType.nullable !== undefined ? !!dataType.nullable : true;
        const charLen = normalizeNumeric(dataType.charLen);
        const precision = normalizeNumeric(dataType.precision);
        const scale = normalizeNumeric(dataType.scale);
        if (charLen !== undefined) normalizedDataType.charLen = charLen;
        if (precision !== undefined) normalizedDataType.precision = precision;
        if (scale !== undefined) normalizedDataType.scale = scale;

        const out: any = {};
        out.ordinalNumber = idx + 1;
        out.name = attr?.name || "";

        const displayName = normalizeOptionalStringField(attr?.displayName);
        if (displayName) out.displayName = displayName;

        const description = normalizeOptionalStringField(attr?.description);
        if (description) out.description = description;

        out.attributeType = attr?.attributeType ?? defaultAttrType ?? "";
        out.dataType = normalizedDataType;

        const isBusinessKey =
          typeof attr?.isBusinessKey === "boolean"
            ? attr.isBusinessKey
            : typeof attr?.isKey === "boolean"
              ? attr.isKey
              : undefined;
        if (typeof isBusinessKey === "boolean") out.isBusinessKey = isBusinessKey;

        const history = normalizeOptionalStringField(attr?.history);
        if (history) out.history = history;

        const expression = normalizeOptionalStringField(attr?.expression);
        if (expression) out.expression = expression;

        const expressionLanguage = normalizeOptionalStringField(attr?.expressionLanguage);
        if (expressionLanguage) out.expressionLanguage = expressionLanguage;

        const unit = normalizeOptionalStringField(attr?.unit);
        if (unit) out.unit = unit;

        if (Array.isArray(attr?.refactorNames) && attr.refactorNames.length > 0) {
          out.refactorNames = attr.refactorNames;
        }

        if (!attr?.__isNew && attr?.__modified && now) {
          out.dateModified = now;
        } else if (attr?.dateModified) {
          out.dateModified = attr.dateModified;
        }

        if (Object.prototype.hasOwnProperty.call(attr, "dateDeleted") && attr.dateDeleted !== undefined) {
          out.dateDeleted = attr.dateDeleted;
        }

        if (attr?.dateAdded) {
          out.dateAdded = attr.dateAdded;
        } else if (now) {
          out.dateAdded = now;
        }

        if (Array.isArray(attr?.properties) && attr.properties.length > 0) {
          out.properties = attr.properties;
        }

        return out;
      });
    },
    [attributeTypeOptions, dataTypes],
  );

  const updateTransformation = useCallback(
    (idx: number, updater: (t: any) => any) => {
      markEntityDirty();
      setTransformations((prev) => normalizeTransformations(prev.map((t, i) => (i === idx ? updater(t) : t))));
    },
    [markEntityDirty, normalizeTransformations],
  );

  const reorderTransformations = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      markEntityDirty();
      setOpenTransformSources((prev) => reindexRecordAfterMove(prev, from, to));
      setTransformSourceCache((prev) => reindexRecordAfterMove(prev, from, to));
      setTransformSourceDirty((prev) => reindexRecordAfterMove(prev, from, to));
      setTransformations((prev) => {
        const next = [...prev];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return normalizeTransformations(next);
      });
    },
    [markEntityDirty, normalizeTransformations],
  );

  useLayoutEffect(() => {
    if (!selectedEntity) return;
    hydratingRef.current = true;
    const previousRelPath = originalRelRef.current;
    if (previousRelPath && previousRelPath !== selectedEntity.relPath && baselineReadyRef.current) {
      pendingSelfSaveAckRelPathRef.current = null;
      const previousDraft: EntityEditorDraft = {
        mode,
        entitySection,
        formState: cloneDeep(formState),
        jsonText,
        attributes: cloneDeep(attributes),
        sources: cloneDeep(sources),
        relationships: cloneDeep(relationships),
        transformations: cloneDeep(transformations),
        properties: cloneDeep(properties),
        openAttributeDetails: cloneDeep(openAttributeDetails),
        openMappingDetails: cloneDeep(openMappingDetails),
        collapsedMappings: cloneDeep(collapsedMappings),
        relationshipZones: cloneDeep(relationshipZones),
        openTransformSources: cloneDeep(openTransformSources),
        transformSourceCache: cloneDeep(transformSourceCache),
        transformSourceDirty: cloneDeep(transformSourceDirty),
      };
      setEntityDraft(previousRelPath, previousDraft);
    }

    const relChanged = selectedEntity.relPath !== originalRelRef.current;
    baselineReadyRef.current = false;
    const { content } = selectedEntity;
    const normalizedAttributes = normalizeAttributes(content?.attributes || [], { forSave: false });
    const withIds = normalizedAttributes.map((a: any) => ({
      ...a,
      __uiId:
        a?.__uiId ||
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `attr-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      __isNew: false,
      __modified: false,
    }));
    const sourceState = cloneDeep(content?.sources || []);
    const normalizedRelationships = (content?.relationships || []).map((rel: any) => ({
      targetModelEntityId: rel.targetModelEntityId ?? rel.targetLocation ?? null,
      mappings: (rel.mappings || rel.attributes || []).map((m: any) => ({
        source: m.source ?? m.sourceName ?? "",
        target: m.target ?? m.targetName ?? "",
      })),
    }));
    const normalizedTransformations = (content?.transformations || []).map((t: any, i: number) => ({
      ...t,
      stepNo: i + 1,
      __uiPrevFunctionSource: t?.kind === "function" ? t.function?.source : undefined,
    }));
    const baseForm = {
      name: content?.name,
      displayName: content?.displayName,
      description: content?.description,
    };
    const localProperties = normalizePropertyAssignments(content?.properties || []);
    const canonical = serializeEntityContent({
      baseContent: content,
      formValues: baseForm,
      attributes: normalizedAttributes,
      sources: sourceState,
      relationships: normalizedRelationships,
      transformations: normalizedTransformations,
      properties: localProperties,
    });
    if (previousRelPath === selectedEntity.relPath && pendingSelfSaveAckRelPathRef.current === selectedEntity.relPath) {
      pendingSelfSaveAckRelPathRef.current = null;
      hydratingRef.current = false;
      return;
    }
    if (previousRelPath === selectedEntity.relPath && baselineReadyRef.current && deepEqual(canonical, originalRef.current)) {
      hydratingRef.current = false;
      return;
    }
    originalRef.current = cloneDeep(canonical);
    originalRelRef.current = selectedEntity.relPath;
    const canonicalJson = JSON.stringify(canonical, null, 2);
    const restored = relChanged ? getEntityDraft(selectedEntity.relPath) : null;
    if (restored) {
      const restoredAttributes = (cloneDeep(restored.attributes || withIds) as any[]).map((a: any) => ({
        ...a,
        __uiId:
          a?.__uiId ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `attr-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      }));
      skipNextDirtyRef.current = false;
      setMode(restored.mode || "form");
      setEntitySection(restored.entitySection || "overview");
      setFormState(cloneDeep(restored.formState || baseForm));
      setJsonText(typeof restored.jsonText === "string" ? restored.jsonText : canonicalJson);
      setAttributes(restoredAttributes);
      setSources(cloneDeep(restored.sources || sourceState));
      setRelationships(cloneDeep(restored.relationships || normalizedRelationships));
      setTransformations(cloneDeep(restored.transformations || normalizedTransformations));
      setProperties(cloneDeep(normalizePropertyAssignments(restored.properties || content?.properties || [])));
      setOpenAttributeDetails(cloneDeep(restored.openAttributeDetails || {}));
      setOpenMappingDetails(cloneDeep(restored.openMappingDetails || {}));
      setCollapsedMappings(cloneDeep(restored.collapsedMappings || {}));
      setRelationshipZones(cloneDeep(restored.relationshipZones || {}));
      setOpenTransformSources(cloneDeep(restored.openTransformSources || {}));
      setTransformSourceCache(cloneDeep(restored.transformSourceCache || {}));
      setTransformSourceDirty(cloneDeep(restored.transformSourceDirty || {}));
      setSaveStatus("idle");
      setSaveError(null);
      baselineReadyRef.current = true;
      scheduleHydrationRelease();
      return;
    }

    skipNextDirtyRef.current = true;
    baselineReadyRef.current = true;
    if (relChanged) {
      setMode("form");
      setEntitySection("overview");
      setOpenAttributeDetails({});
      setOpenMappingDetails({});
      setCollapsedMappings({});
      setRelationshipZones({});
      setOpenTransformSources({});
      setTransformSourceCache({});
      setTransformSourceDirty({});
    }
    setFormState(baseForm);
    setJsonText(canonicalJson);
    setSaveStatus("idle");
    setSaveError(null);
    setAttributes(withIds);
    setSources(sourceState);
    setRelationships(normalizedRelationships);
    setTransformations(normalizedTransformations);
    setProperties(normalizePropertyAssignments(content?.properties || []));
    scheduleHydrationRelease();
  // This hydration effect intentionally runs when the selected entity changes. It snapshots
  // the previous editor state before replacing local state; adding every editor field would
  // rehydrate while the user edits and break draft retention.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEntityDraft, normalizeAttributes, scheduleHydrationRelease, selectedEntity, setEntityDraft]);

  useEffect(() => {
    if (!relationships.length) {
      setRelationshipZones({});
      return;
    }
    setRelationshipZones((prev) => {
      const next: Record<number, string> = {};
      relationships.forEach((rel, idx) => {
        const target = modelEntities.find((m) => m.content?.id === rel.targetModelEntityId);
        const zone = target ? zoneFromRelPath(target.relPath) : prev[idx] || "";
        if (zone) next[idx] = zone;
      });
      return next;
    });
  }, [relationships, modelEntities, zoneFromRelPath]);

  const buildDraftContent = useCallback(
    (opts?: { forSave?: boolean }) => {
      const forSave = opts?.forSave ?? false;
      if (!selectedEntity) return null;
      if (mode === "json") {
        try {
          const parsed = JSON.parse(jsonText);
          if (forSave && parsed && typeof parsed === "object") {
            delete (parsed as any).effectiveProperties;
          }
          const normalizedAttributes = normalizeAttributes(parsed?.attributes || [], { forSave });
          const sourcePayload = forSave ? normalizeSourcesForSave(parsed?.sources || []) : parsed?.sources || [];
          return { ...parsed, attributes: normalizedAttributes, sources: sourcePayload };
        } catch {
          return "parse-error";
        }
      }
      const normalizedSources = forSave ? normalizeSourcesForSave(sources) : sources;
      const normalizedRelationships = forSave ? normalizeRelationshipsForSave(relationships) : relationships;
      const normalizedAttributes = normalizeAttributes(attributes, { forSave });
      return serializeEntityContent({
        baseContent: selectedEntity.content,
        formValues: formState,
        attributes: normalizedAttributes,
        sources: normalizedSources,
        relationships: normalizedRelationships,
        transformations,
        properties: normalizePropertyAssignments(properties),
      });
    },
    [
      attributes,
      formState,
      mode,
      normalizeAttributes,
      properties,
      relationships,
      selectedEntity,
      sources,
      transformations,
      jsonText,
    ],
  );

  useEffect(() => {
    if (!selectedEntity || originalRelRef.current !== selectedEntity.relPath || !baselineReadyRef.current) return;
    if (hydratingRef.current) return;
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if (!selectedEntity || originalRelRef.current !== selectedEntity.relPath || hydratingRef.current) return;
      const draft = buildDraftContent();
      let isDirty = false;
      if (draft === "parse-error") {
        isDirty = true;
      } else {
        isDirty = !deepEqual(draft, originalRef.current);
      }
      if (!isDirty && Object.values(transformSourceDirty).some(Boolean)) {
        isDirty = true;
      }
      entityDirtyRef.current = isDirty;
      if (!isDirty) {
        persistQueuedRef.current = false;
        pendingPersistReasonRef.current = null;
        pendingPersistRevisionRef.current = 0;
        setSaveStatus("idle");
        setSaveError(null);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [buildDraftContent, selectedEntity, transformSourceDirty]);

  useEffect(() => {
    if (!selectedEntity || originalRelRef.current !== selectedEntity.relPath || !baselineReadyRef.current) return;
    if (hydratingRef.current) return;
    const relPath = selectedEntity.relPath;
    const timer = window.setTimeout(() => {
      if (!selectedEntity || originalRelRef.current !== relPath || hydratingRef.current) return;
      const draft: EntityEditorDraft = {
        mode,
        entitySection,
        formState: cloneDeep(formState),
        jsonText,
        attributes: cloneDeep(attributes),
        sources: cloneDeep(sources),
        relationships: cloneDeep(relationships),
        transformations: cloneDeep(transformations),
        properties: cloneDeep(properties),
        openAttributeDetails: cloneDeep(openAttributeDetails),
        openMappingDetails: cloneDeep(openMappingDetails),
        collapsedMappings: cloneDeep(collapsedMappings),
        relationshipZones: cloneDeep(relationshipZones),
        openTransformSources: cloneDeep(openTransformSources),
        transformSourceCache: cloneDeep(transformSourceCache),
        transformSourceDirty: cloneDeep(transformSourceDirty),
      };
      setEntityDraft(relPath, draft);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    attributes,
    collapsedMappings,
    entitySection,
    formState,
    jsonText,
    mode,
    openAttributeDetails,
    openMappingDetails,
    openTransformSources,
    properties,
    relationshipZones,
    relationships,
    selectedEntity,
    setEntityDraft,
    sources,
    transformations,
    transformSourceCache,
    transformSourceDirty,
  ]);

  const onSubmit = useCallback(async (): Promise<boolean> => {
    if (!selectedEntity) return false;
    setSaveStatus("saving");
    setSaveError(null);
    try {
      const draft = buildDraftContent({ forSave: true });
      if (!draft || draft === "parse-error") {
        setSaveStatus("error");
        setSaveError("Please fix JSON before saving.");
        onDirtyEntity(selectedEntity.relPath, true);
        return false;
      }
      const newContent = draft;
      const functionTransforms = (transformations || [])
        .map((t, idx) => ({ t, idx }))
        .filter((item) => item.t.kind === "function" && item.t.function?.source);
      const dirtyFunctionItems = functionTransforms
        .map(({ idx, t }) => ({ idx, t, code: transformSourceCache[idx], dirty: transformSourceDirty[idx] === true }))
        .filter((item) => item.dirty && item.code !== undefined);

      for (const item of dirtyFunctionItems) {
        await saveFunctionSource({
          relPath: selectedEntity.relPath,
          source: item.t.function?.source,
          entityName: String((newContent as any)?.name || selectedEntity?.content?.name || selectedEntity?.name || ""),
          content: item.code,
          solutionPath: solutionPath || undefined,
        });
      }
      if (dirtyFunctionItems.length) {
        setTransformSourceDirty((prev) => {
          const next = { ...prev };
          dirtyFunctionItems.forEach((item) => {
            next[item.idx] = false;
          });
          return next;
        });
      }
      pendingSelfSaveAckRelPathRef.current = selectedEntity.relPath;
      await onSave({ ...selectedEntity, content: newContent, name: newContent?.name || selectedEntity.name });
      originalRef.current = cloneDeep(newContent);
      skipNextDirtyRef.current = true;
      entityDirtyRef.current = false;
      onDirtyEntity(selectedEntity.relPath, false);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 1500);
      console.log(`[DataM8] Entity saved: ${selectedEntity.relPath}`);
      toast({ variant: "success", title: "Saved", description: selectedEntity.name || selectedEntity.relPath, duration: 3500 });
      return true;
    } catch (err) {
      pendingSelfSaveAckRelPathRef.current = null;
      console.error("[DataM8] Entity save failed:", err);
      setSaveStatus("error");
      setSaveError((err as Error).message);
      onDirtyEntity(selectedEntity.relPath, true);
      return false;
    }
  }, [
    buildDraftContent,
    onDirtyEntity,
    onSave,
    selectedEntity,
    solutionPath,
    transformSourceCache,
    transformSourceDirty,
    transformations,
  ]);

  const persistNow = useCallback(
    async (reason: PersistReason): Promise<boolean> => {
      if (!selectedEntity || !entityDirtyRef.current) return true;
      if (persistInFlightRef.current) {
        persistQueuedRef.current = true;
        return false;
      }
      persistInFlightRef.current = true;
      const saveStartedRevision = changeRevisionRef.current;
      const ok = await onSubmit();
      persistInFlightRef.current = false;
      const queued = resolveQueuedPersistAfterSave(
        persistQueuedRef.current,
        reason,
        changeRevisionRef.current,
        saveStartedRevision,
      );
      if (queued.shouldReschedule) {
        persistQueuedRef.current = false;
        entityDirtyRef.current = queued.dirty;
        pendingPersistReasonRef.current = queued.reason;
        pendingPersistRevisionRef.current = queued.revision;
        setPersistRequestTick((value) => value + 1);
      }
      return ok;
    },
    [onSubmit, selectedEntity],
  );

  const persistAfterStateFlush = useCallback(
    (reason: PersistReason) => {
      pendingPersistReasonRef.current = reason;
      pendingPersistRevisionRef.current = changeRevisionRef.current;
      setPersistRequestTick((value) => value + 1);
    },
    [],
  );

  useEffect(() => {
    const reason = pendingPersistReasonRef.current;
    if (!reason) return;
    if (changeRevision < pendingPersistRevisionRef.current) return;
    pendingPersistReasonRef.current = null;
    pendingPersistRevisionRef.current = 0;
    void persistNow(reason);
  }, [changeRevision, persistNow, persistRequestTick]);

  const retrySave = useCallback(() => {
    void persistNow("tab-switch");
  }, [persistNow]);

  const { notifySaveFailure, resetSaveFailureToastMemory } = useSaveFailureToast({
    contextKey: `entity:${selectedEntity?.relPath || "none"}`,
    onRetry: retrySave,
  });

  useEffect(() => {
    if (saveStatus === "error") {
      notifySaveFailure(saveError);
      return;
    }
    resetSaveFailureToastMemory();
  }, [notifySaveFailure, resetSaveFailureToastMemory, saveError, saveStatus]);

  return {
    // state
    selectedEntity,
    mode,
    setMode,
    formState,
    setFormState,
    jsonText,
    setJsonText,
    saveStatus,
    saveError,
    setSaveError,
    entitySection,
    setEntitySection,
    attributes,
    setAttributes,
    sources,
    setSources,
    relationships,
    setRelationships,
    transformations,
    setTransformations,
    properties,
    setProperties,
    openAttributeDetails,
    setOpenAttributeDetails,
    openMappingDetails,
    setOpenMappingDetails,
    collapsedMappings,
    setCollapsedMappings,
    relationshipZones,
    setRelationshipZones,
    openTransformSources,
    setOpenTransformSources,
    dragTransformIndex,
    transformSourceCache,
    setTransformSourceCache,
    transformSourceDirty,
    setTransformSourceDirty,
    // helpers
    markEntityDirty,
    entityPropertyRows,
    entityInheritedProps,
    effectiveDataProduct,
    effectiveDataModule,
    zones,
    zoneFromRelPath,
    modelEntities,
    resolveEntityMetaById,
    resolveEntityNameById,
    transformKinds,
    normalizeTransformations,
    updateTransformation,
    reorderTransformations,
    onSubmit,
    persistNow,
    persistAfterStateFlush,
    retrySave,
    dataTypes,
    attributeTypeOptions,
    dataTypeDefinitions,
    solutionPath,
    propertyOptions,
    dataSourceOptions,
    dataSourceDetails,
    onJumpToEntity,
    onJumpToDataSource,
    onPatchBaseEntity,
    dataSourcesRelPath,
  };
};
