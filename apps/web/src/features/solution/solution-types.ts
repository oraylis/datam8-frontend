export type Solution = {
  schemaVersion: string;
  basePath: string;
  modelPath: string;
  pluginsPath?: string;
  generatorTargets: Array<{
    name: string;
    isDefault?: boolean;
    sourcePath: string;
    outputPath: string;
  }>;
};
