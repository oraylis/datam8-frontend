import { useMemo } from "react";
import type {
  BaseAttributeType,
  BaseDataSource,
  BaseDataSourceType,
  BaseDataTypeDefinition,
  BaseEntity,
  BaseZone,
} from "../../model-types";
import { detectBaseType } from "../../model-utils";
import { buildPropertyOptionsFromBaseEntities } from "../../property-options";

export type WizardZone = {
  name: string;
  displayName: string;
  targetName: string;
  localFolderName: string;
};

export type WizardDataSource = {
  name: string;
  type: string;
  extendedProperties: Record<string, unknown>;
};

export type ResolvedWizardDataSource = WizardDataSource & {
  dataSourceType: BaseDataSourceType | null;
  connectorId: string | null;
};

type UseWizardBaseDataResult = {
  zones: WizardZone[];
  dataSources: WizardDataSource[];
  dataSourcesRelPath: string | null;
  dataTypes: string[];
  attributeTypes: string[];
  propertyOptions: { name: string; values: string[] }[];
  dataSourcesResolved: ResolvedWizardDataSource[];
};

export function buildWizardPropertyOptions(baseEntities: BaseEntity[]) {
  return buildPropertyOptionsFromBaseEntities(baseEntities);
}

export function resolveWizardDataSources(args: {
  dataSources: WizardDataSource[];
  dataSourceTypes: BaseDataSourceType[];
}): ResolvedWizardDataSource[] {
  const { dataSources, dataSourceTypes } = args;
  return dataSources.map((ds: WizardDataSource) => {
    const dst = dataSourceTypes.find((t: BaseDataSourceType) => t?.name === ds.type) || null;
    const connectorId = `${dst?.pluginId || ""}`.trim() || null;
    return { ...ds, dataSourceType: dst, connectorId };
  });
}

export function useWizardBaseData(baseEntities: BaseEntity[]): UseWizardBaseDataResult {
  const zones = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "zones");
    return (entry?.content?.zones || [])
      .filter((z: BaseZone) => Boolean(z?.localFolderName?.trim()))
      .map((z: BaseZone) => ({
        name: typeof z.name === "string" ? z.name : "",
        displayName: typeof z.displayName === "string" ? z.displayName : "",
        targetName: typeof z.targetName === "string" ? z.targetName : "",
        localFolderName: z.localFolderName || "",
      }));
  }, [baseEntities]);

  const dataSources = useMemo(() => {
    const dsEntry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSources");
    return (dsEntry?.content?.dataSources || []).map((d: BaseDataSource) => ({
      name: d.name,
      type: d.type || d.dataSourceType || "",
      extendedProperties:
        d.extendedProperties && typeof d.extendedProperties === "object"
          ? (d.extendedProperties as Record<string, unknown>)
          : {},
    }));
  }, [baseEntities]);

  const dataSourcesRelPath = useMemo(() => {
    const dsEntry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSources");
    return dsEntry?.relPath || null;
  }, [baseEntities]);

  const dataSourceTypes = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataSourceTypes");
    return entry?.content?.dataSourceTypes || [];
  }, [baseEntities]);

  const dataTypes = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "dataTypes");
    return (entry?.content?.dataTypes || []).map((dt: BaseDataTypeDefinition) => dt.name);
  }, [baseEntities]);

  const attributeTypes = useMemo(() => {
    const entry = baseEntities.find((b) => detectBaseType(b.content, b.relPath).type === "attributeTypes");
    return (entry?.content?.attributeTypes || []).map((at: BaseAttributeType) => at.name);
  }, [baseEntities]);

  const propertyOptions = useMemo(() => buildWizardPropertyOptions(baseEntities), [baseEntities]);

  const dataSourcesResolved = useMemo<ResolvedWizardDataSource[]>(() => {
    return resolveWizardDataSources({ dataSources, dataSourceTypes });
  }, [dataSourceTypes, dataSources]);

  return {
    zones,
    dataSources,
    dataSourcesRelPath,
    dataTypes,
    attributeTypes,
    propertyOptions,
    dataSourcesResolved,
  };
}
