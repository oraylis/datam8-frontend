import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

function getArgValue(prefix: string): string | null {
  const arg = process.argv.find((v) => v.startsWith(prefix));
  if (!arg) return null;
  const raw = arg.slice(prefix.length);
  return raw ? raw : null;
}

function getApiBaseFromArgs(): string | null {
  const base = getArgValue("--datam8-api-base=");
  return typeof base === "string" && base.trim() ? base.trim() : null;
}

function getTokenFromArgs(): string | null {
  const token = getArgValue("--datam8-token=");
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  apiBase: getApiBaseFromArgs(),
  token: getTokenFromArgs(),
  window: {
    setSolutionPath: (solutionPath: string | null) => ipcRenderer.invoke("window:set-solution-path", solutionPath),
    getTitle: () => ipcRenderer.invoke("window:get-title"),
    onTitleChanged: (callback: (title: string) => void) => {
      const handler = (_event: IpcRendererEvent, title: string) => callback(title);
      ipcRenderer.on("window:title-changed", handler);
      return () => ipcRenderer.off("window:title-changed", handler);
    },
  },
  solution: {
    pickOpenPath: () => ipcRenderer.invoke("solution:pick-open-path"),
    pickSavePath: () => ipcRenderer.invoke("solution:pick-save-path"),
    pickDirectory: () => ipcRenderer.invoke("solution:pick-directory"),
    pickPluginArtifacts: () => ipcRenderer.invoke("solution:pick-plugin-artifacts"),
    detectVersion: (solutionPath: string) => ipcRenderer.invoke("solution:detect-version", solutionPath),
    load: (solutionPath: string) => ipcRenderer.invoke("solution:load", solutionPath),
    createNew: (payload: { saveDir: string; solutionName: string; basePath?: string; modelPath?: string }) =>
      ipcRenderer.invoke("solution:create-new", payload),
    migrateV1ToV2: (payload: { sourceSolutionPath: string; targetDir: string }) =>
      ipcRenderer.invoke("solution:migrate-v1-to-v2", payload),
    importPlugins: (payload: { solutionPath: string; artifactPaths: string[] }) =>
      ipcRenderer.invoke("solution:import-plugins", payload),
    readFunctionSource: (payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) =>
      ipcRenderer.invoke("solution:read-function-source", payload),
    saveFunctionSource: (payload: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string }) =>
      ipcRenderer.invoke("solution:save-function-source", payload),
    renameFunctionSource: (payload: { relPath: string; fromSource: string; toSource: string; entityName?: string; solutionPath?: string }) =>
      ipcRenderer.invoke("solution:rename-function-source", payload),
    deleteFunctionSource: (payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) =>
      ipcRenderer.invoke("solution:delete-function-source", payload),
    renameFolder: (payload: { fromFolderPath: string; toFolderPath: string; solutionPath?: string }) =>
      ipcRenderer.invoke("solution:rename-folder", payload),
    validate: (payload: { solutionPath: string; logLevel?: string }) =>
      ipcRenderer.invoke("solution:validate", payload),
    generate: (payload: { solutionPath: string; target: string; logLevel?: string; cleanOutput?: boolean }) =>
      ipcRenderer.invoke("solution:generate", payload),
    onOpenPath: (callback: (path: string) => void) => {
      const handler = (_event: IpcRendererEvent, filePath: string) => callback(filePath);
      ipcRenderer.on("solution:open-path", handler);
      return () => ipcRenderer.off("solution:open-path", handler);
    },
  },
  menu: {
    getTopLevelLabels: () => ipcRenderer.invoke("menu:get-top-level-labels"),
    popupSubmenu: (label: string, x: number, y: number) => ipcRenderer.invoke("menu:popup-submenu", label, x, y),
  },
  theme: {
    current: () => ipcRenderer.invoke("theme:get-current"),
    setCurrent: (theme: string) => ipcRenderer.invoke("theme:set-current", theme),
    onThemeChanged: (callback: (theme: string) => void) => {
      const handler = (_event: IpcRendererEvent, theme: string) => callback(theme);
      ipcRenderer.on("theme:changed", handler);
      return () => ipcRenderer.off("theme:changed", handler);
    },
  },
});

