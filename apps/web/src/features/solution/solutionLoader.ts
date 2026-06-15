import type { BaseEntity, BaseEntityContent, FolderEntity, ModelEntity } from "../model/model-types";
import {
  folderPathFromRelPath,
  locatorToClientString,
} from "../model/locator-utils";
import type { Solution } from "./solution-types";
import { apiBase, setRuntimeApiBase } from "../../config";
import { V1SolutionDetectedError } from "./errors";
import { readBackendErrorMessage } from "../../shared/api/errorMessage";

export type SolutionSource =
  | { kind: "uploaded-file"; file: File }
  | { kind: "server-path"; path: string }
  | { kind: "electron-path"; path: string };

export type LoadedSolution = {
  solution: Solution;
  modelEntities: ModelEntity[];
  baseEntities: BaseEntity[];
  folderEntities: FolderEntity[];
};

export type ElectronSolutionBridge = {
  pickSolutionFile?: () => Promise<string | { path?: string; canceled?: boolean } | null | undefined>;
  loadSolution?: (path: string) => Promise<unknown>;
  readSolutionFile?: (path: string) => Promise<unknown>;
};

declare global {
  interface Window {
    electron?: ElectronSolutionBridge;
    desktop?: {
      isElectron?: boolean;
      platform?: string | null;
      apiBase?: string | null;
      token?: string | null;
      window?: {
        setSolutionPath?: (solutionPath: string | null) => Promise<boolean> | boolean;
        getTitle?: () => Promise<string | null> | string | null;
        onTitleChanged?: (callback: (title: string) => void) => () => void;
      };
      solution?: {
        pickOpenPath?: () => Promise<string | null>;
        pickSavePath?: () => Promise<string | null>;
        pickDirectory?: () => Promise<string | null>;
        pickPluginArtifacts?: () => Promise<string[] | null>;
        detectVersion?: (solutionPath: string) => Promise<{ version?: "v1" | "v2"; path?: string } | null>;
        load?: (solutionPath: string) => Promise<{ path?: string; payload?: unknown; apiBase?: string | null; token?: string | null } | null>;
        createNew?: (payload: { saveDir: string; solutionName: string; basePath?: string; modelPath?: string }) => Promise<{ solutionPath?: string; payload?: unknown; apiBase?: string | null; token?: string | null } | null>;
        migrateV1ToV2?: (payload: { sourceSolutionPath: string; targetDir: string }) => Promise<{ solutionPath?: string; payload?: unknown; apiBase?: string | null; token?: string | null } | null>;
        importPlugins?: (payload: { solutionPath: string; artifactPaths: string[] }) => Promise<{ imported?: number; plugins?: unknown } | null>;
        readFunctionSource?: (payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) => Promise<{ content?: string } | null>;
        saveFunctionSource?: (payload: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string }) => Promise<{ path?: string } | null>;
        renameFunctionSource?: (payload: { relPath: string; fromSource: string; toSource: string; entityName?: string; solutionPath?: string }) => Promise<{ skipped?: boolean; fromPath?: string; toPath?: string } | null>;
        deleteFunctionSource?: (payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) => Promise<{ path?: string } | null>;
        renameFolder?: (payload: { fromFolderPath: string; toFolderPath: string; solutionPath?: string }) => Promise<{ fromPath?: string; toPath?: string } | null>;
        validate?: (payload: { solutionPath: string; logLevel?: string }) => Promise<{ success?: boolean; message?: string; messages?: string[] } | null>;
        generate?: (payload: { solutionPath: string; target: string; logLevel?: string; cleanOutput?: boolean }) => Promise<{ success?: boolean; message?: string; messages?: string[]; target?: string } | null>;
        onOpenPath?: (callback: (path: string) => void) => () => void;
        loadSolution?: (path: string) => Promise<unknown>;
        readSolutionFile?: (path: string) => Promise<unknown>;
      };
      menu?: {
        getTopLevelLabels?: () => Promise<string[]> | string[];
        popupSubmenu?: (label: string, x: number, y: number) => Promise<boolean> | boolean;
      };
      theme?: {
        current?: () => Promise<string | null> | string | null;
        setCurrent?: (theme: string) => Promise<boolean> | boolean;
        onThemeChanged?: (callback: (theme: string) => void) => () => void;
      };
    };
  }
}

function normalizeModelEntity(entry: any, modelPath: string): ModelEntity {
  const locatorObj = entry?.locator;
  const locatorFolders = Array.isArray(locatorObj?.folders) ? locatorObj.folders : [];
  const locatorEntityName = typeof locatorObj?.entityName === "string" ? locatorObj.entityName : "";
  const relPath =
    entry?.relPath ||
    entry?.rel_path ||
    entry?.path ||
    deriveRelPathFromSourceFile(entry, modelPath, "") ||
    normalizeSegments([modelPath, ...locatorFolders, `${locatorEntityName}.json`]).join("/");
  const content = (entry?.entity ?? entry?.content ?? {}) as Record<string, unknown>;
  const locator = locatorToClientString({
    locator: locatorObj,
    relPath,
    modelPath,
  });
  const name =
    (typeof content?.name === "string" && content.name.trim()) ||
    entry.name ||
    locatorEntityName ||
    (relPath ? relPath.split(/[\\/]/).pop()?.replace(/\.json$/i, "") || "" : "");
  return {
    locator,
    name,
    relPath,
    content: content as any,
  };
}

function normalizeBaseEntity(entry: any, modelPath: string, basePath: string): BaseEntity {
  const relPath = deriveRelPathFromSourceFile(entry, modelPath, basePath) || entry.relPath || entry.path || "";
  const name =
    entry.name ||
    (relPath ? relPath.split(/[\\/]/).pop()?.replace(/\.json$/i, "") || "" : "");
  return {
    locator: locatorToClientString({
      locator: entry.locator,
      relPath,
    }),
    name,
    relPath,
    content: entry.content ?? {},
  };
}

function normalizeFolderEntity(entry: any, modelPath: string): FolderEntity {
  const locatorObj = entry?.locator;
  const locatorFolders = Array.isArray(locatorObj?.folders) ? locatorObj.folders : [];
  const locatorEntityName = typeof locatorObj?.entityName === "string" ? locatorObj.entityName : "";
  const fullFolderPath = normalizeSegments([...locatorFolders, locatorEntityName]).join("/");
  const relPath =
    entry?.relPath ||
    entry?.rel_path ||
    entry?.path ||
    deriveRelPathFromSourceFile(entry, modelPath, "") ||
    normalizeSegments([modelPath, fullFolderPath, ".properties.json"]).join("/");
  const rawFolderPath =
    (entry.folderPath || "").split(/[\\/]/).join("/").replace(/^\/+|\/+$/g, "") ||
    fullFolderPath ||
    folderPathFromRelPath(relPath, modelPath);
  const rawLocator = locatorToClientString({
    locator: locatorObj,
    folderPath: rawFolderPath,
    relPath,
    modelPath,
  });
  const folderPath =
    rawFolderPath ||
    (rawLocator.startsWith("/folders/") ? rawLocator.slice("/folders/".length) : rawLocator === "/folders" ? "" : "");
  const locator = locatorToClientString({
    locator: rawLocator,
    folderPath,
    relPath,
    modelPath,
  });
  const name = entry.name || (folderPath ? folderPath.split("/").pop() || "" : "");
  const content = (entry?.entity ?? entry?.content ?? {}) as Record<string, unknown>;
  return {
    locator,
    name,
    relPath,
    folderPath,
    content: content as any,
  };
}

function normalizeSegments(parts: string[]): string[] {
  return parts
    .map((part) => `${part || ""}`.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
}

function deriveRelPathFromSourceFile(entry: any, modelPath: string, basePath: string): string | null {
  const sourceFile = `${entry?.source_file || entry?.sourceFile || ""}`.trim();
  if (!sourceFile) return null;
  const normalized = sourceFile.replace(/\\/g, "/");
  const modelMarker = `/${(modelPath || "Model").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}/`;
  const baseMarker = `/${(basePath || "Base").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")}/`;
  const modelIdx = normalized.toLowerCase().indexOf(modelMarker.toLowerCase());
  if (modelIdx >= 0) {
    return normalized.slice(modelIdx + 1);
  }
  const baseIdx = normalized.toLowerCase().indexOf(baseMarker.toLowerCase());
  if (baseIdx >= 0) {
    return normalized.slice(baseIdx + 1);
  }
  return null;
}

function baseArrayKeyByEntityType(entityTypeRaw: unknown): string {
  const entityType = `${entityTypeRaw || ""}`.trim();
  switch (entityType) {
    case "attributeTypes":
      return "attributeTypes";
    case "dataProducts":
      return "dataProducts";
    case "dataModules":
      return "dataModules";
    case "dataSourceTypes":
      return "dataSourceTypes";
    case "dataSources":
      return "dataSources";
    case "dataTypes":
      return "dataTypes";
    case "properties":
      return "properties";
    case "propertyValues":
      return "propertyValues";
    case "propertyValueProperties":
      return "propertyValueProperties";
    case "propertyValueAttributes":
      return "propertyValueAttributes";
    case "zones":
      return "zones";
    default:
      return entityType || "items";
  }
}

function normalizePayload(payload: any): LoadedSolution {
  const solution = (payload?.solution || payload) as Solution;
  if (!solution?.schemaVersion || !solution?.basePath || !solution?.modelPath) {
    throw new Error("Invalid solution payload");
  }
  const modelPath = solution.modelPath || "Model";
  const basePath = solution.basePath || "Base";
  const modelSource =
    payload?.modelEntities ??
    payload?.model_entities ??
    payload?.model?.entities ??
    payload?.solution?.modelEntities ??
    payload?.solution?.model_entities ??
    [];
  const baseSource =
    payload?.baseEntities ??
    payload?.base_entities ??
    payload?.base?.entities ??
    payload?.solution?.baseEntities ??
    payload?.solution?.base_entities ??
    [];
  const folderSource =
    payload?.folderEntities ??
    payload?.folder_entities ??
    payload?.solution?.folderEntities ??
    payload?.solution?.folder_entities ??
    [];

  const usesWrapperFormat = (baseSource || []).some(
    (entry: any) => !!entry && typeof entry === "object" && ("source_file" in entry || "sourceFile" in entry) && ("entity" in entry),
  );

  const groupedBaseByRelPath = new Map<string, BaseEntityContent & { type?: string }>();
  if (usesWrapperFormat) {
    for (const entry of baseSource || []) {
      const relPath = deriveRelPathFromSourceFile(entry, modelPath, basePath) || entry?.relPath || entry?.path || "";
      if (!relPath) continue;
      const locatorType = entry?.locator?.entityType;
      const key = baseArrayKeyByEntityType(locatorType);
      const existing = groupedBaseByRelPath.get(relPath) || { type: `${locatorType || ""}` };
      const next = { ...existing } as Record<string, unknown>;
      const arr = Array.isArray(next[key]) ? ([...next[key] as unknown[]]) : [];
      arr.push(entry?.entity ?? entry?.content ?? {});
      next[key] = arr;
      groupedBaseByRelPath.set(relPath, next as BaseEntityContent & { type?: string });
    }
  }

  const normalizedBaseEntities: BaseEntity[] =
    usesWrapperFormat && groupedBaseByRelPath.size > 0
      ? Array.from(groupedBaseByRelPath.entries()).map(([relPath, content]) =>
          normalizeBaseEntity({ relPath, content }, modelPath, basePath),
        )
      : (baseSource || []).map((entry: any) => normalizeBaseEntity(entry, modelPath, basePath));

  return {
    solution,
    modelEntities: (modelSource || []).map((entry: any) => normalizeModelEntity(entry, modelPath)),
    baseEntities: normalizedBaseEntities,
    folderEntities: (folderSource || []).map((entry: any) => normalizeFolderEntity(entry, modelPath)),
  };
}

async function loadFromServer(path: string): Promise<LoadedSolution> {
  // Non-desktop mode cannot switch backend workspace by path; keep the input for UX parity
  // and load the currently bound solution from the active backend instance.
  void path;
  const res = await fetch(`${apiBase}/solution/full`);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    if (payload !== null) {
      throw new Error(readBackendErrorMessage(payload, `API error ${res.status}`));
    }
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `API error ${res.status}`);
  }
  const data = await res.json();
  return normalizePayload(data);
}

async function loadFromUploadedFile(file: File): Promise<LoadedSolution> {
  const raw = await file.text();
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && !("schemaVersion" in parsed) && "basePath" in parsed) {
    throw new Error("V1 solutions must be migrated from a file path (upload is not supported).");
  }
  return normalizePayload(parsed);
}

async function loadFromElectron(path: string): Promise<LoadedSolution> {
  const desktopBridge = window.desktop?.solution;
  const bridge = window.electron;

  if (desktopBridge?.detectVersion) {
    const inspected = await desktopBridge.detectVersion(path);
    const version = inspected?.version;
    if (version === "v1") {
      throw new V1SolutionDetectedError(path);
    }
  }

  if (desktopBridge?.load) {
    const loaded = await desktopBridge.load(path);
    setRuntimeApiBase(loaded?.apiBase);
    return normalizePayload((loaded as any)?.payload ?? loaded);
  }

  if (desktopBridge?.loadSolution) {
    const data = await desktopBridge.loadSolution(path);
    return normalizePayload(data);
  }

  if (desktopBridge?.readSolutionFile) {
    const data = await desktopBridge.readSolutionFile(path);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return normalizePayload(parsed);
  }

  if (bridge?.loadSolution) {
    const data = await bridge.loadSolution(path);
    return normalizePayload(data);
  }

  if (bridge?.readSolutionFile) {
    const data = await bridge.readSolutionFile(path);
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return normalizePayload(parsed);
  }

  throw new Error("Desktop bridge is missing required solution load capability.");
}

export async function loadSolution(source: SolutionSource): Promise<LoadedSolution> {
  switch (source.kind) {
    case "server-path":
      return loadFromServer(source.path);
    case "uploaded-file":
      return loadFromUploadedFile(source.file);
    case "electron-path":
      return loadFromElectron(source.path);
    default: {
      const neverSource: never = source;
      throw new Error(`Unsupported solution source ${(neverSource as any)?.kind ?? "unknown"}`);
    }
  }
}
