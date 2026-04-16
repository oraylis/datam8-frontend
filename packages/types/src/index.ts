export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

export type GeneratorTarget = {
  name: string;
  isDefault?: boolean;
  sourcePath: string;
  outputPath: string;
};

export type Solution = {
  schemaVersion: string;
  basePath: string;
  modelPath: string;
  generatorTargets: GeneratorTarget[];
};

export type ConnectionProperty = {
  name: string;
  required?: boolean;
  description?: string;
  [key: string]: JsonValue | undefined;
};

export type ConnectionProperties = ConnectionProperty[];

export type ConnectorBinding = {
  connectorId: string;
  connectorVersion?: string | null;
};

export type PropertyAssignment = {
  property: string;
  value?: string;
  [key: string]: JsonValue | undefined;
};

export type PropertyScope = {
  type: string;
  singleUsage?: boolean;
  mandatory?: boolean;
};

export type PropertyRefactorScopeTarget = "entity" | "folder" | string;

export type PropertyRename = {
  oldName: string;
  newName: string;
};

export type PropertyValueRename = {
  property: string;
  oldValue: string;
  newValue: string;
};

export type PropertyValueDelete = {
  property: string;
  value: string;
};

export type PropertyValueMove = {
  oldProperty: string;
  oldValue: string;
  newProperty: string;
  newValue: string;
};

export type PropertyRefactorPayload = {
  propertyRenames: PropertyRename[];
  valueRenames: PropertyValueRename[];
  deletedProperties: string[];
  deletedValues: PropertyValueDelete[];
  valueMoves: PropertyValueMove[];
};
