import type { PropertyAssignment } from "@datam8/types";

export type EntityDataType = {
  type?: string;
  nullable?: boolean;
  charLen?: number;
  precision?: number;
  scale?: number;
  [key: string]: unknown;
};

export type EntityAttribute = {
  name?: string;
  displayName?: string;
  attributeType?: string;
  dataType?: EntityDataType;
  isBusinessKey?: boolean;
  unit?: string;
  history?: string;
  expression?: string;
  expressionLanguage?: string;
  description?: string;
  properties?: PropertyAssignment[];
  ordinalNumber?: number;
  dateAdded?: string;
  refactorNames?: string[];
  __uiId?: string;
  __isNew?: boolean;
  __modified?: boolean;
  [key: string]: unknown;
};

export type EntityPropertyRow = {
  item: PropertyAssignment;
  inherited: boolean;
  idx?: number;
};

export type EntityReference = {
  name: string;
  relPath: string;
  zone?: string;
};

export type EntitySource = Record<string, unknown>;
export type EntityRelationship = Record<string, unknown>;
export type EntityTransformation = Record<string, unknown>;
