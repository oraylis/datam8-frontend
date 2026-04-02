import type { PropertyAssignment } from "@datam8/types";

type LooseObject = Record<string, unknown>;

export type ModelEntityContent = LooseObject & {
  id?: string | number;
  name?: string;
  displayName?: string;
  description?: string;
  sourceEntityId?: string | number | null;
  sourceEntityIds?: Array<string | number>;
  attributes?: LooseObject[];
  sources?: LooseObject[];
  relationships?: LooseObject[];
  transformations?: LooseObject[];
  properties?: PropertyAssignment[];
};

export type BaseDataTypeDefinition = LooseObject & {
  name: string;
  hasCharLen?: boolean;
  hasPrecision?: boolean;
  hasScale?: boolean;
};

export type BaseAttributeType = LooseObject & {
  name: string;
  displayName?: string;
};

export type BaseDataModule = LooseObject & {
  name: string;
};

export type BaseDataProduct = LooseObject & {
  name: string;
  dataModules?: BaseDataModule[];
};

export type BaseZone = LooseObject & {
  name?: string;
  displayName?: string;
  targetName?: string;
  localFolderName?: string;
  properties?: PropertyAssignment[];
};

export type BaseDataSource = LooseObject & {
  name: string;
  type?: string;
  dataSourceType?: string;
  extendedProperties?: LooseObject;
};

export type BaseDataSourceType = LooseObject & {
  name: string;
  pluginId?: string;
  connectionProperties?: unknown;
  authModes?: LooseObject[];
  dataTypeMapping?: LooseObject[];
};

export type BaseProperty = LooseObject & {
  name: string;
  displayName?: string;
  schema?: string;
  scopes?: BasePropertyScope[];
};

export type BasePropertyScope = LooseObject & {
  type: string;
  singleUsage?: boolean;
  mandatory?: boolean;
};

export type BasePropertyValue = LooseObject & {
  property: string;
  name: string;
};

export type BaseEntityContent = LooseObject & {
  attributeTypes?: BaseAttributeType[];
  dataTypes?: BaseDataTypeDefinition[];
  datatypes?: BaseDataTypeDefinition[];
  dataSources?: BaseDataSource[];
  dataSourceTypes?: BaseDataSourceType[];
  dataProducts?: BaseDataProduct[];
  zones?: BaseZone[];
  properties?: BaseProperty[];
  propertyValues?: BasePropertyValue[];
  propertyValueProperties?: LooseObject[];
  propertyValueAttributes?: LooseObject[];
};

export type FolderMeta = LooseObject & {
  id?: number;
  name?: string;
  displayName?: string;
  description?: string;
  path?: string;
  dataProduct?: string;
  dataModule?: string;
  properties?: PropertyAssignment[];
};

// Backend v2 returns folder metadata as a direct folder object.
// Keep optional legacy fields to stay robust for older fixtures.
export type FolderContent = FolderMeta & {
  type?: string;
  folders?: FolderMeta[];
};

export type ModelEntity = {
  locator: string;
  name: string;
  relPath: string;
  content: ModelEntityContent;
};

export type BaseEntity = {
  locator?: string;
  name: string;
  relPath: string;
  content: BaseEntityContent;
};

export type FolderEntity = {
  locator: string;
  name: string;
  relPath: string;
  folderPath: string;
  content: FolderContent;
};

export type ColumnMetadata = {
  name: string;
  ordinal: number;
  dataType: string;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  isNullable: boolean;
  isPrimaryKey: boolean;
};

export type TableMetadata = {
  schema: string;
  name: string;
  type: "BASE TABLE" | "VIEW";
  columns: ColumnMetadata[];
};

export type PropertyOption = { name: string; values: string[] };

export type Tab = {
  id: string;
  title: string;
  kind: "entity" | "base" | "settings";
};

export type EntitySection = "overview" | "attributes" | "sources" | "relationships" | "transformations";

export type ModelTab = { relPath: string; title: string; dirty: boolean };
export type BaseTab = { relPath: string; title: string; dirty: boolean };

export type TreeNode = {
  label: string;
  relPath?: string;
  type: "folder" | "entity";
  children?: TreeNode[];
  path?: string;
};
