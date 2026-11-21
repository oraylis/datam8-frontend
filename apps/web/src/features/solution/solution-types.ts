export type Solution = {
  schemaVersion: string;
  basePath: string;
  modelPath: string;
  pluginsPath?: string;
  diagramPath?: string | null;
  generatorTargets: Array<{
    name: string;
    isDefault?: boolean;
    sourcePath: string;
    outputPath: string;
  }>;
};
