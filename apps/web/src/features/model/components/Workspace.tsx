import { useEffect, useMemo } from "react";
import type { PropertyAssignment } from "@datam8/types";
import type { BaseDataSourceType, BaseEntity, ModelEntity, PropertyOption, Tab } from "../model-types";
import { detectBaseType } from "../model-utils";
import { EntityEditor } from "./workspace/entity-editor/EntityEditor";
import { BaseEditor } from "./workspace/base-editor/BaseEditor";
import { useEntityState } from "./workspace/hooks/useEntityState";
import { useBaseEditorState } from "./workspace/hooks/useBaseEditorState";
import { buildPropertyScopeTypeOptions } from "../refactor/propertyRefactorScopes";

type DataSourceDetails = {
  name: string;
  typeName?: string;
  extendedProperties: Record<string, unknown>;
  dataTypeMapping?: unknown;
  dataSourceType: BaseDataSourceType | null;
  connector: {
    id: string | null;
    version: string | null;
  };
};

type BaseEntityUpdater = (content: BaseEntity["content"]) => BaseEntity["content"];
type BaseItemSelectionRequest = {
  relPath: string;
  itemName: string;
  token: number;
};

export function Workspace({
  activeTab,
  activeWorkTab,
  selectedEntity,
  onSave,
  baseEntities,
  selectedBase,
  onSelectBase,
  onSaveBase,
  onDirtyEntity,
  onDirtyBase,
  dataTypes,
  dataTypeDefinitions,
  attributeTypeOptions,
  baseItemSelectionRequest,
  propertyOptions,
  modelEntities,
  solutionPath,
  generatorTargets,
  entityInheritedProps,
  entityEffectiveDataProduct,
  entityEffectiveDataModule,
  onJumpToEntity,
  onJumpToDataSource,
  onPatchBaseEntity,
  getEntityDraft,
  setEntityDraft,
  getBaseDraft,
  setBaseDraft,
  registerEntityPersist,
  registerBasePersist,
}: {
  activeTab: Tab;
  activeWorkTab: string | null;
  selectedEntity: ModelEntity | null;
  onSave: (updated: ModelEntity) => Promise<void>;
  baseEntities: BaseEntity[];
  selectedBase: BaseEntity | null;
  onSelectBase: (relPath: string, title?: string) => void;
  onSaveBase: (updated: BaseEntity) => Promise<void>;
  onDirtyEntity: (relPath: string, dirty: boolean) => void;
  onDirtyBase: (relPath: string, dirty: boolean) => void;
  dataTypes: string[];
  dataTypeDefinitions: Record<string, { hasCharLen?: boolean; hasPrecision?: boolean; hasScale?: boolean }>;
  attributeTypeOptions: { value: string; label: string }[];
  baseItemSelectionRequest?: BaseItemSelectionRequest | null;
  propertyOptions: PropertyOption[];
  modelEntities: ModelEntity[];
  solutionPath: string;
  generatorTargets: string[];
  entityInheritedProps?: { folderProps: PropertyAssignment[] };
  entityEffectiveDataProduct?: string;
  entityEffectiveDataModule?: string;
  onJumpToEntity: (relPath: string) => void;
  onJumpToDataSource: (name: string) => void;
  onPatchBaseEntity: (relPath: string, updater: BaseEntityUpdater) => void;
  getEntityDraft: (relPath: string) => any | null;
  setEntityDraft: (relPath: string, draft: any | null) => void;
  getBaseDraft: (relPath: string) => any | null;
  setBaseDraft: (relPath: string, draft: any | null) => void;
  registerEntityPersist?: (persist: (() => Promise<boolean>) | null) => void;
  registerBasePersist?: (persist: (() => Promise<boolean>) | null) => void;
}) {
  const dataSourceOptions = useMemo(() => {
    const names = new Set<string>();
    baseEntities.forEach((b) => {
      (b.content?.dataSources || []).forEach((ds) => {
        if (ds?.name) names.add(ds.name);
      });
    });
    return Array.from(names).sort();
  }, [baseEntities]);

  const dataSourceTypes = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSourceTypes");
    return entry?.content?.dataSourceTypes || [];
  }, [baseEntities]);

  const dataSourceDetailsResolved = useMemo(() => {
    const map: Record<string, DataSourceDetails> = {};
    const typesByName = new Map<string, BaseDataSourceType>((dataSourceTypes || []).map((t) => [t?.name, t]));

    baseEntities.forEach((b) => {
      (b.content?.dataSources || []).forEach((ds) => {
        if (!ds?.name) return;
        const typeName = ds.type || ds.dataSourceType;
        const dst = typeName ? typesByName.get(typeName) ?? null : null;
        const extendedProperties =
          ds.extendedProperties && typeof ds.extendedProperties === "object"
            ? (ds.extendedProperties as Record<string, unknown>)
            : {};
        map[ds.name] = {
          name: ds.name,
          typeName,
          extendedProperties,
          dataTypeMapping: ds.dataTypeMapping,
          dataSourceType: dst,
          connector: {
            id: `${dst?.pluginId || ""}`.trim() || null,
            version: null,
          },
        };
      });
    });
    return map;
  }, [baseEntities, dataSourceTypes]);

  const dataSourcesRelPath = useMemo(
    () => baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSources")?.relPath || null,
    [baseEntities],
  );
  const dataSourceTypesRelPath = useMemo(
    () => baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSourceTypes")?.relPath || null,
    [baseEntities],
  );

  const propertyScopeTypeOptions = useMemo(() => buildPropertyScopeTypeOptions(baseEntities), [baseEntities]);

  const entityState = useEntityState({
    selectedEntity,
    modelEntities,
    entityInheritedProps,
    effectiveDataProduct: entityEffectiveDataProduct,
    effectiveDataModule: entityEffectiveDataModule,
    propertyOptions,
    dataTypes,
    solutionPath,
    dataSourceDetails: dataSourceDetailsResolved,
    attributeTypeOptions,
    dataTypeDefinitions,
    onDirtyEntity,
    onSave,
    onJumpToEntity,
    onJumpToDataSource,
    onPatchBaseEntity,
    getEntityDraft,
    setEntityDraft,
    dataSourceOptions,
    dataSourcesRelPath,
  });

  const baseState = useBaseEditorState({
    baseEntities,
    selectedBase,
    onSelectBase,
    onSaveBase,
    onDirtyBase,
    baseItemSelectionRequest: baseItemSelectionRequest || null,
    propertyOptions,
    generatorTargets,
    dataTypes,
    getBaseDraft,
    setBaseEditorDraft: setBaseDraft,
  });

  const persistEntityNow = entityState.persistNow;
  const persistBaseNow = baseState.persistNow;

  useEffect(() => {
    registerEntityPersist?.(() => persistEntityNow("tab-switch"));
    return () => registerEntityPersist?.(null);
  }, [persistEntityNow, registerEntityPersist]);

  useEffect(() => {
    registerBasePersist?.(() => persistBaseNow("tab-switch"));
    return () => registerBasePersist?.(null);
  }, [persistBaseNow, registerBasePersist]);

  const content = (() => {
    switch (activeTab.kind) {
      case "entity":
        return <EntityEditor {...entityState} />;
      case "base":
        return (
          <BaseEditor
            selectedBase={selectedBase}
            onDirtyBase={onDirtyBase}
            onPatchBaseEntity={onPatchBaseEntity}
            dataSourcesRelPath={dataSourcesRelPath}
            dataSourceTypesRelPath={dataSourceTypesRelPath}
            propertyScopeTypeOptions={propertyScopeTypeOptions}
            {...baseState}
          />
        );
      default:
        return (
          <div className="panel">
            <div className="panel__header">
              <div className="panel__title">Settings</div>
            </div>
            <div className="panel__body">Solution settings and paths.</div>
          </div>
        );
    }
  })();

  if (!activeWorkTab) {
    return (
      <div className="workspace workspace--empty">
        <div className="empty">
          <div className="empty__title">No tab open</div>
          <div className="empty__subtitle">Select an entity or base entry from the sidebar to begin.</div>
        </div>
      </div>
    );
  }

  return <div className="workspace">{content}</div>;
}
