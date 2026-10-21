import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, type MenuItemConstructorOptions, type IpcMainInvokeEvent } from "electron";
import { autoUpdater } from "electron-updater";
import { waitForBackendReady, waitForBackendHealth } from "../resources/backend-startup.cjs";
import { terminateChild } from "../resources/backend-lifecycle.cjs";
import { buildPythonEnv } from "../resources/backend-env.cjs";
import { loopback, parseVersion, REPOSITORY, releaseUrl, requireWindowsPublisher } from "../resources/update-policy.cjs";
import { DesktopUpdates } from "./updates";
import type { UpdatePreparation } from "../../../packages/types/src/desktop-updates";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "child_process";

import { APP_DISPLAY_NAME } from "./appConfig";
import { UserSettings } from "./userSettings";

const isDevToolsAllowed = () => !app.isPackaged || process.env.DATAM8_ALLOW_DEVTOOLS === "1";

// Ensure the app shows a stable, user-friendly name in menus/installer integrations,
// without breaking existing installations that may already have user data stored under
// the legacy package-based app name.
const legacyUserDataPath = app.getPath("userData");
app.setName(APP_DISPLAY_NAME);
const preferredUserDataPath = app.getPath("userData");
try {
  if (fs.existsSync(legacyUserDataPath) && !fs.existsSync(preferredUserDataPath)) {
    app.setPath("userData", legacyUserDataPath);
  }
} catch {
  // If path probing fails for any reason, keep Electron defaults.
}
// Development helpers are excluded from packaged apps and loaded only here.
const development: typeof import("./developerSimulation") | null = app.isPackaged ? null : require("./developerSimulation");
const updateDemo = !app.isPackaged && process.env.DATAM8_UPDATE_SANDBOX === "1" && typeof process.send === "function";
const developerSimulation = development && !updateDemo ? new development.DeveloperSimulation(app.getAppPath()) : null;
if (updateDemo && process.env.DATAM8_UPDATE_DEMO_PROFILE) app.setPath("userData", path.resolve(process.env.DATAM8_UPDATE_DEMO_PROFILE));
// Installer acceptance needs its automatically relaunched copy to retain the
// same disposable profile. This override requires both loopback test services.
if (process.env.DATAM8_UPDATE_TEST_PROFILE && process.env.DATAM8_UPDATE_TEST_FEED && process.env.DATAM8_UPDATE_TEST_RELEASES) {
  loopback(process.env.DATAM8_UPDATE_TEST_FEED); loopback(process.env.DATAM8_UPDATE_TEST_RELEASES);
  app.setPath("userData", path.resolve(process.env.DATAM8_UPDATE_TEST_PROFILE));
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let shutdownComplete = false;
let developmentShutdown = false;
let backendStopPromise: Promise<void> | null = null;
let updates: DesktopUpdates | null = null;
let preparingUpdate = false;
let installingUpdate = false;
let solutionOperations = 0;
let preparation: { id: string; resolve: (result: UpdatePreparation) => void } | null = null;
let currentSolutionPath: string | null = null;

let backendProcess: ChildProcessWithoutNullStreams | null = null;
let backendBaseUrl: string | null = null;
const backendToken = crypto.randomBytes(24).toString("hex");
let backendVersion: string | null = null;
let backendStartPromise: Promise<void> | null = null;
let backendSolutionPath: string | null = null;
let backendWorkspaceId: string | null = null;
type BackendRuntime = { pythonPath: string; source: string; moduleName: string };
let backendRuntime: BackendRuntime | null = null;
let backendStartupAbort: AbortController | null = null;
type AppTheme = "light" | "dark" | "system";
let currentAppTheme: AppTheme = "system";
let applicationMenu: Menu | null = null;
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = Number(process.env.DATAM8_BACKEND_TEST_PORT || "4318");
if (!Number.isInteger(BACKEND_PORT) || BACKEND_PORT < 1024 || BACKEND_PORT > 65535) throw new Error("DATAM8_BACKEND_TEST_PORT must be a port between 1024 and 65535.");
const BACKEND_OUTPUT_PREVIEW_LIMIT = 8192;

function cleanBackendOutputLine(line: string): string {
  return `${line || ""}`
    .replace(/^\s*[|│]\s?/, "")
    .replace(/\s?[|│]\s*$/, "")
    .trim();
}

function isBackendOutputNoise(line: string): boolean {
  if (!line) return true;
  if (/^[+\-─━═╭╮╰╯┌┐└┘│| ]+$/.test(line)) return true;
  if (/^-+$/.test(line)) return true;
  if (/^Traceback \(most recent call last\)/i.test(line)) return true;
  if (/^in [_a-zA-Z0-9]+:\d+$/i.test(line)) return true;
  if (/^\d+\s*$/.test(line)) return true;
  if (/^\d+\s+/.test(line)) return true;
  if (/^[> ]*\d+\s+/.test(line)) return true;
  if (/^[A-Z]:\\.*(?:\.py|site-packages|Lib\\)/i.test(line)) return true;
  return false;
}

function stripPythonContainerSyntax(message: string): string {
  let next = message.trim();
  next = next.replace(/^HTTPException:\s*\d+:\s*/i, "");
  next = next.replace(/^Error:\s*/i, "");
  const listMatch = next.match(/^\[\s*(['"])([\s\S]*)\1\s*\]$/);
  if (listMatch) next = listMatch[2];
  const quoteMatch = next.match(/^(['"])([\s\S]*)\1$/);
  if (quoteMatch) next = quoteMatch[2];
  return next.replace(/\\n/g, "\n").trim();
}

function simplifyBackendErrorMessage(message: string, output?: string): string {
  const fallback = `${message || ""}`.trim() || "Backend failed to open the solution.";
  const candidates = `${output || ""}`
    .split(/\r?\n/)
    .map(cleanBackendOutputLine)
    .filter((line) => !isBackendOutputNoise(line));
  const selected = candidates.at(-1) || fallback;
  return stripPythonContainerSyntax(selected) || fallback;
}

function withOpenSolutionPrefix(message: string): string {
  const cleaned = `${message || ""}`.trim();
  if (!cleaned) return "Failed to open solution.";
  if (/^Failed to open solution\b/i.test(cleaned)) return cleaned;
  return `Failed to open solution: ${cleaned}`;
}

function getWindowsChromeColors(theme: "light" | "dark") {
  if (theme === "light") {
    return {
      backgroundColor: "#f3f3f3",
      overlayColor: "#00000000",
      symbolColor: "#1f2937",
    };
  }

  return {
    backgroundColor: "#202126",
    overlayColor: "#00000000",
    symbolColor: "#f5f7fb",
  };
}

function resolvedAppTheme(theme: AppTheme): "light" | "dark" {
  return theme === "system" ? (nativeTheme.shouldUseDarkColors ? "dark" : "light") : theme;
}

function syncWindowsTitleBarTheme(targetWindow: BrowserWindow | null, theme: AppTheme = currentAppTheme) {
  if (!targetWindow || process.platform !== "win32") return;
  const colors = getWindowsChromeColors(resolvedAppTheme(theme));
  targetWindow.setBackgroundColor(colors.backgroundColor);
  targetWindow.setTitleBarOverlay({
    color: colors.overlayColor,
    symbolColor: colors.symbolColor,
    height: 36,
  });
}

function computeWindowTitle(solutionPath?: string | null): string {
  const pathPart = (solutionPath || "").trim();
  const name = updateDemo ? `${APP_DISPLAY_NAME} — Update Simulation` : APP_DISPLAY_NAME;
  return pathPart ? `${name} (${pathPart})` : name;
}

function syncWindowTitle() {
  if (!mainWindow) return;
  const title = computeWindowTitle(currentSolutionPath);
  mainWindow.setTitle(title);
  mainWindow.webContents.send("window:title-changed", title);
}

function ensureExecutable(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    if (process.platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
}

function platformSubdir(): "win" | "mac" | "linux" {
  if (process.platform === "win32") return "win";
  if (process.platform === "darwin") return "mac";
  return "linux";
}

function resolveRepoRoot(): string | null {
  const candidates = [
    process.cwd(),
    // In dev, __dirname points at .../apps/desktop/dist
    path.resolve(__dirname, "..", "..", ".."),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];

  for (const candidate of candidates) {
    try {
      const submoduleDir = path.join(candidate, "submodules", "datam8-generator");
      const pyproject = path.join(submoduleDir, "pyproject.toml");
      if (fs.existsSync(pyproject) && fs.statSync(pyproject).isFile()) {
        return candidate;
      }
    } catch {
      // ignore and try next
    }
  }
  return null;
}

function canRunCommand(command: string): boolean {
  try {
    const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: process.platform === "win32" });
    return !result.error;
  } catch {
    return false;
  }
}

function looksLikePath(value: string): boolean {
  return value.includes("\\") || value.includes("/") || /^[a-zA-Z]:/.test(value);
}

function isRunnablePython(candidate: string): boolean {
  if (looksLikePath(candidate)) {
    return ensureExecutable(candidate);
  }
  return canRunCommand(candidate);
}

function resolvePackagedPythonCandidates(): string[] {
  if (process.platform === "win32") {
    return [
      path.join(process.resourcesPath, "python-runtime", "python.exe"),
      path.join(process.resourcesPath, "python-runtime", "Scripts", "python.exe"),
      path.join(process.resourcesPath, "python-runtime", "pythonw.exe"),
      path.join(process.resourcesPath, "python-embedded", "python.exe"),
      path.join(process.resourcesPath, "python", "python.exe"),
    ];
  }

  return [
    path.join(process.resourcesPath, "python-runtime", "bin", "python3"),
    path.join(process.resourcesPath, "python-runtime", "bin", "python"),
    path.join(process.resourcesPath, "python-embedded", "bin", "python3"),
    path.join(process.resourcesPath, "python-embedded", "python3"),
    path.join(process.resourcesPath, "python", "bin", "python3"),
    path.join(process.resourcesPath, "python", "bin", "python"),
    path.join(process.resourcesPath, "python", "python3"),
  ];
}

function appendOutputPreview(preview: { value: string }, label: "stdout" | "stderr", chunk: unknown): void {
  const text = String(chunk);
  preview.value += `[${label}] ${text}`;
  if (preview.value.length > BACKEND_OUTPUT_PREVIEW_LIMIT) {
    preview.value = preview.value.slice(-BACKEND_OUTPUT_PREVIEW_LIMIT);
  }
}

function resolvePythonRuntime(settings: UserSettings): { pythonPath: string; source: string } | null {
  const override = process.env.DATAM8_PYTHON_PATH;
  if (override) return isRunnablePython(override) ? { pythonPath: override, source: "DATAM8_PYTHON_PATH" } : null;
  if (settings.pythonPath) return isRunnablePython(settings.pythonPath)
    ? { pythonPath: settings.pythonPath, source: ".user-settings.json" } : null;
  if (app.isPackaged) {
    const pythonPath = resolvePackagedPythonCandidates().find(ensureExecutable);
    return pythonPath ? { pythonPath, source: "bundled runtime" } : null;
  }
  const repoRoot = resolveRepoRoot();
  if (repoRoot) {
    const venv = path.join(repoRoot, "submodules/datam8-generator/.venv");
    const pythonPath = path.join(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
    if (ensureExecutable(pythonPath)) return { pythonPath, source: "Generator development environment" };
  }
  return null;
}

function resolveBackendRuntime(solutionPath: string): BackendRuntime {
  const settings = UserSettings.parseFromSolution(path.dirname(solutionPath));
  const python = resolvePythonRuntime(settings);
  if (!python) throw new Error("Python runtime not found. Prepare the Generator .venv for development or reinstall the packaged app. DATAM8_PYTHON_PATH can select an explicit interpreter.");
  const moduleName = (process.env.DATAM8_BACKEND_MODULE || settings.backendModule || "datam8").trim();
  if (!moduleName) throw new Error("The configured backend module must not be empty.");
  return { ...python, moduleName };
}

async function stopBackend() {
  backendStartupAbort?.abort();
  if (backendStopPromise) return backendStopPromise;
  if (!backendProcess) return;
  const proc = backendProcess;
  const previous = { baseUrl: backendBaseUrl, version: backendVersion, solutionPath: backendSolutionPath, workspaceId: backendWorkspaceId, runtime: backendRuntime };
  backendProcess = null;
  backendBaseUrl = null;
  backendVersion = null;
  backendSolutionPath = null;
  backendWorkspaceId = null;
  backendRuntime = null;

  backendStopPromise = terminateChild(proc);
  try { await backendStopPromise; if (updateDemo && process.connected) process.send?.({ type: "backend-stopped", pid: proc.pid }); }
  catch (error) {
    if (proc.exitCode === null && proc.signalCode === null) {
      backendProcess = proc; backendBaseUrl = previous.baseUrl; backendVersion = previous.version; backendSolutionPath = previous.solutionPath;
      backendWorkspaceId = previous.workspaceId; backendRuntime = previous.runtime;
    }
    throw error;
  }
  finally { backendStopPromise = null; }
}

function normalizeExistingFilePath(value: string): string {
  const candidate = `${value || ""}`.trim();
  if (!candidate) {
    throw new Error("Select a DataM8 solution file.");
  }
  const absolute = path.resolve(candidate);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Solution file not found: ${absolute}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    throw new Error(`Selected path is a folder. Select the .dm8s solution file inside it: ${absolute}`);
  }
  if (!stat.isFile()) {
    throw new Error(`Selected path is not a file: ${absolute}`);
  }
  if (!absolute.toLowerCase().endsWith(".dm8s")) {
    throw new Error("Selected file is not a DataM8 solution. Expected a .dm8s file.");
  }
  return absolute;
}

function normalizeDirectoryPath(value: string): string {
  const candidate = `${value || ""}`.trim();
  if (!candidate) {
    throw new Error("Directory path is required.");
  }
  const absolute = path.resolve(candidate);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    throw new Error(`Directory not found: ${absolute}`);
  }
  return absolute;
}

function isDangerousMigrationTarget(targetDir: string): boolean {
  const root = path.parse(targetDir).root;
  return targetDir === root;
}

function detectSolutionVersion(solutionFilePath: string): "v1" | "v2" {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(solutionFilePath, "utf8"));
  } catch (err) {
    throw new Error(`Cannot read solution '${solutionFilePath}': ${(err as Error).message}`);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const value = parsed as Record<string, unknown>;
    if (typeof value.schemaVersion === "string" && value.schemaVersion.trim()) return "v2";
    const paths = ["basePath", "rawPath", "stagingPath", "corePath", "curatedPath", "generatePath", "diagramPath", "outputPath"];
    const areas = value.AreaTypes;
    if (
      !("schemaVersion" in value) && paths.every((key) => typeof value[key] === "string") &&
      areas && typeof areas === "object" && !Array.isArray(areas) &&
      ["Raw", "Stage", "Core", "Curated", "Diagram"].every((key) => typeof (areas as Record<string, unknown>)[key] === "string")
    ) return "v1";
  }
  throw new Error(`Invalid solution structure: ${solutionFilePath}`);
}

async function backendRequestJson<T>(relativePath: string, init?: RequestInit): Promise<T> {
  if (!backendBaseUrl) {
    throw new Error("Backend is not running.");
  }
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${backendToken}`);
  if (backendWorkspaceId) headers.set("X-DataM8-Workspace", backendWorkspaceId);
  const response = await fetch(`${backendBaseUrl}${relativePath}`, { ...(init || {}), headers });
  const data = await response.json();
  if (!response.ok) {
    const message = (data as { message?: unknown } | null | undefined)?.message;
    const msg = typeof message === "string" ? message : `HTTP ${response.status}`;
    throw new Error(msg);
  }
  return data as T;
}

async function loadCurrentSolutionPayload() {
  return await backendRequestJson<unknown>("/solution/full");
}

async function ensureBackendForSolution(solutionPath: string): Promise<void> {
  const normalized = normalizeExistingFilePath(solutionPath);
  const runtime = resolveBackendRuntime(normalized);
  if (backendProcess && backendBaseUrl
      && backendRuntime?.pythonPath === runtime.pythonPath && backendRuntime.moduleName === runtime.moduleName) {
    await waitForBackendHealth(backendBaseUrl, backendToken, 2_500);
    if (!backendSolutionPath || path.resolve(backendSolutionPath) !== normalized) {
      const workspace = await backendRequestJson<{ workspaceId: string }>("/workspace/open", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: normalized }),
      });
      backendWorkspaceId = workspace.workspaceId;
      backendSolutionPath = normalized;
      console.log(`[datam8] Workspace opened: ${JSON.stringify(normalized)}; reusing backend PID ${backendProcess.pid}.`);
    }
  } else {
    await stopBackend();
    await startBackend(normalized, runtime);
  }
  currentSolutionPath = normalized;
  syncWindowTitle();
}

function runPythonCli(
  runtime: BackendRuntime,
  args: string[],
): { stdout: string; stderr: string } {
  const { pythonPath, moduleName, source } = runtime;
  console.log(`[datam8] Running ${moduleName} ${args[0]}: Python=${JSON.stringify(pythonPath)} (source: ${source}).`);
  const result = spawnSync(pythonPath, ["-m", moduleName, ...args], {
    env: buildPythonEnv(pythonPath, path.join(process.resourcesPath, "python-runtime")),
    shell: false,
    stdio: "pipe",
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== 0) {
    const stderr = `${result.stderr || ""}`.trim();
    const stdout = `${result.stdout || ""}`.trim();
    throw new Error(stderr || stdout || `Command failed: datam8 ${args.join(" ")}`);
  }
  return { stdout: `${result.stdout || ""}`, stderr: `${result.stderr || ""}` };
}

async function createSolutionViaCli(params: {
  saveDir: string;
  solutionName: string;
  basePath?: string;
  modelPath?: string;
}): Promise<string> {
  const saveDir = normalizeDirectoryPath(params.saveDir);
  const solutionName = `${params.solutionName || ""}`.trim();
  if (!solutionName) throw new Error("Solution name is required.");

  const solutionDir = saveDir;
  const solutionFile = path.join(solutionDir, `${solutionName}.dm8s`);
  fs.mkdirSync(solutionDir, { recursive: true });

  const runtime = resolveBackendRuntime(solutionFile);
  runPythonCli(runtime, ["init", solutionName, "--solution", solutionFile, "--type", "empty"]);

  // Optional path overrides (still v2 compliant) if user customized defaults.
  const basePath = `${params.basePath || ""}`.trim();
  const modelPath = `${params.modelPath || ""}`.trim();
  if (basePath || modelPath) {
    const raw = fs.readFileSync(solutionFile, "utf8");
    const parsed = JSON.parse(raw);
    if (basePath) parsed.basePath = basePath;
    if (modelPath) parsed.modelPath = modelPath;
    fs.writeFileSync(solutionFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    if (basePath) fs.mkdirSync(path.join(solutionDir, basePath), { recursive: true });
    if (modelPath) fs.mkdirSync(path.join(solutionDir, modelPath), { recursive: true });
  }

  return solutionFile;
}

async function migrateSolutionViaCli(params: { sourceSolutionPath: string; targetDir: string }): Promise<string> {
  const sourceSolutionPath = normalizeExistingFilePath(params.sourceSolutionPath);
  const targetDir = normalizeDirectoryPath(params.targetDir);
  if (isDangerousMigrationTarget(targetDir)) {
    throw new Error("Refusing migration target at filesystem root.");
  }

  const sourceParent = path.dirname(sourceSolutionPath);
  const normalizedSourceParent = path.resolve(sourceParent);
  const normalizedTargetDir = path.resolve(targetDir);
  if (normalizedTargetDir === normalizedSourceParent) {
    throw new Error("Migration target must not be the source solution directory.");
  }

  const runtime = resolveBackendRuntime(path.join(normalizedTargetDir, path.basename(sourceSolutionPath)));
  runPythonCli(runtime, [
    "migrate",
    "v1-to-v2",
    "--solution",
    sourceSolutionPath,
    "--output-dir",
    normalizedTargetDir,
  ]);

  const targetSolutionPath = path.join(normalizedTargetDir, path.basename(sourceSolutionPath));
  if (!fs.existsSync(targetSolutionPath)) {
    throw new Error(`Migration finished but no solution file was found at ${targetSolutionPath}`);
  }
  return targetSolutionPath;
}

function parseCliOutputLines(result: { stdout: string; stderr: string }): string[] {
  const stdout = `${result.stdout || ""}`.trim();
  const stderr = `${result.stderr || ""}`.trim();
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^API ready at\s+`/i.test(line));
  const deduped = Array.from(new Set(lines));
  return deduped;
}

async function generateSolutionViaCli(params: { solutionPath: string; target: string; logLevel?: string }): Promise<{
  success: boolean;
  message: string;
  messages: string[];
  target: string;
}> {
  const solutionPath = normalizeExistingFilePath(params.solutionPath);
  const target = `${params.target || ""}`.trim();
  if (!target) {
    throw new Error("Generator target is required.");
  }

  const runtime = resolveBackendRuntime(solutionPath);

  const args = ["generate", target, "--solution", solutionPath];
  const logLevel = `${params.logLevel || ""}`.trim();
  if (logLevel) {
    args.push("--log-level", logLevel);
  }
  // Always clean generator output before rendering to match frontend behavior.
  args.push("--clean-output");
  const result = runPythonCli(runtime, args);
  const deduped = parseCliOutputLines(result);
  return {
    success: true,
    message: deduped[0] || "Generation successful.",
    messages: deduped.length ? deduped : ["Generation successful."],
    target,
  };
}

function importPluginArtifacts(params: { solutionPath: string; artifactPaths: string[] }): number {
  const solutionPath = normalizeExistingFilePath(params.solutionPath);
  const solutionDir = path.dirname(solutionPath);
  const raw = fs.readFileSync(solutionPath, "utf8");
  const solution = JSON.parse(raw);
  const pluginsPath = typeof solution?.pluginsPath === "string" ? solution.pluginsPath.trim() : "";
  if (!pluginsPath) {
    throw new Error("Solution does not declare pluginsPath.");
  }
  const targetDir = path.resolve(solutionDir, pluginsPath);
  fs.mkdirSync(targetDir, { recursive: true });

  let imported = 0;
  for (const artifactPathRaw of params.artifactPaths || []) {
    const artifactPath = path.resolve(`${artifactPathRaw || ""}`.trim());
    if (!artifactPath) continue;
    if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
      throw new Error(`Plugin artifact not found: ${artifactPath}`);
    }

    const ext = path.extname(artifactPath).toLowerCase();
    if (ext === ".zip") {
      importPluginZipArtifact(artifactPath, targetDir);
      imported += 1;
      continue;
    }

    const fileName = path.basename(artifactPath);
    const destination = path.join(targetDir, fileName);
    fs.copyFileSync(artifactPath, destination);
    imported += 1;
  }
  return imported;
}

type ZipEntry = {
  entryName: string;
  isDirectory: boolean;
};

type ZipArchive = {
  getEntries: () => ZipEntry[];
  readAsText: (entry: ZipEntry) => string;
  extractAllTo: (targetPath: string, overwrite?: boolean) => void;
};

type ZipArchiveCtor = new (zipPath: string) => ZipArchive;

function importPluginZipArtifact(zipPath: string, pluginsTargetDir: string): void {
  const AdmZipModule = (() => {
    try {
      // Lazy-load ZIP support so a missing optional module cannot crash app startup.
      return require("adm-zip");
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot import ZIP plugin artifacts because 'adm-zip' is unavailable. ${detail}`);
    }
  })();
  const AdmZipCtor = (AdmZipModule?.default || AdmZipModule) as ZipArchiveCtor | undefined;
  if (typeof AdmZipCtor !== "function") {
    throw new Error("Cannot import ZIP plugin artifacts because 'adm-zip' did not export a constructor.");
  }
  const zip = new AdmZipCtor(zipPath);
  const entries = zip.getEntries();
  if (!entries.length) {
    throw new Error(`Plugin ZIP is empty: ${zipPath}`);
  }

  const pluginJsonEntry = entries.find((entry) => {
    const normalized = entry.entryName.replace(/\\/g, "/").toLowerCase();
    return !entry.isDirectory && normalized.endsWith("plugin.json");
  });
  if (!pluginJsonEntry) {
    throw new Error(`Plugin ZIP does not contain plugin.json: ${zipPath}`);
  }

  let pluginId = "";
  try {
    const manifest = JSON.parse(zip.readAsText(pluginJsonEntry));
    pluginId = `${manifest?.id || ""}`.trim();
  } catch {
    throw new Error(`Invalid plugin.json in ZIP: ${zipPath}`);
  }

  const fallbackName = path.basename(zipPath, path.extname(zipPath));
  const folderName = sanitizePathSegment(pluginId || fallbackName);
  if (!folderName) {
    throw new Error(`Could not derive plugin folder name from ZIP: ${zipPath}`);
  }

  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    if (normalized.includes("..") || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
      throw new Error(`Unsafe ZIP entry path detected: ${entry.entryName}`);
    }
  }

  const destinationDir = path.join(pluginsTargetDir, folderName);
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.mkdirSync(destinationDir, { recursive: true });
  zip.extractAllTo(destinationDir, true);
}

function getSolutionRootDir(solutionPath?: string | null): string {
  const candidate = `${solutionPath || backendSolutionPath || currentSolutionPath || ""}`.trim();
  if (!candidate) throw new Error("No solution loaded.");
  return path.dirname(normalizeExistingFilePath(candidate));
}

function sanitizePathSegment(value: string): string {
  return `${value || ""}`.trim().replace(/[\\/]/g, "_").replace(/\0/g, "");
}

function deriveFunctionSourceFolderName(relPath: string, entityName?: string): string {
  const safeEntity = sanitizePathSegment(entityName || "");
  if (safeEntity) return safeEntity;
  return sanitizePathSegment(path.basename(relPath, path.extname(relPath)));
}

function resolveSafeNestedPath(baseDir: string, sourcePath: string): string {
  if (!sourcePath || sourcePath.includes("\0")) {
    throw new Error("Invalid function source path.");
  }
  if (sourcePath.includes("\\")) {
    throw new Error("Function source path must use '/'.");
  }
  if (path.isAbsolute(sourcePath) || /^[a-zA-Z]:/.test(sourcePath)) {
    throw new Error("Function source path must be relative.");
  }
  const parts = sourcePath.split("/").filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
    throw new Error("Function source path must not contain '.' or '..'.");
  }
  const absPath = path.resolve(baseDir, ...parts);
  const normalizedBase = path.resolve(baseDir);
  const normalizedAbs = path.resolve(absPath);
  if (!(normalizedAbs === normalizedBase || normalizedAbs.startsWith(`${normalizedBase}${path.sep}`))) {
    throw new Error("Function source path escapes entity directory.");
  }
  return normalizedAbs;
}

function resolveFunctionSourcePaths(params: {
  solutionPath?: string;
  relPath: string;
  source: string;
  entityName?: string;
}): { preferredPath: string; fallbackPath: string; legacyPath: string; entityDir: string } {
  const solutionRoot = getSolutionRootDir(params.solutionPath);
  const relPath = `${params.relPath || ""}`.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!relPath) throw new Error("Entity relPath is required.");
  const source = `${params.source || ""}`.trim();
  if (!source) throw new Error("Function source is required.");
  const entityDirRel = path.posix.dirname(relPath);
  const entityDir = path.resolve(solutionRoot, entityDirRel === "." ? "" : entityDirRel);

  if (source.includes("/")) {
    const abs = resolveSafeNestedPath(entityDir, source);
    return { preferredPath: abs, fallbackPath: abs, legacyPath: abs, entityDir };
  }

  const folderName = deriveFunctionSourceFolderName(relPath, params.entityName);
  const fallbackFolderName = sanitizePathSegment(path.basename(relPath, path.extname(relPath)));
  // v2 resolves a bare function source relative to the entity file. Keep the
  // historical per-entity folders as read/delete fallbacks for old solutions.
  const legacyPath = path.resolve(entityDir, source);
  const preferredPath = legacyPath;
  const fallbackPath = path.resolve(entityDir, folderName, source);
  if (fallbackPath === preferredPath && fallbackFolderName !== folderName) {
    return {
      preferredPath,
      fallbackPath: path.resolve(entityDir, fallbackFolderName, source),
      legacyPath,
      entityDir,
    };
  }
  return { preferredPath, fallbackPath, legacyPath, entityDir };
}

function readFunctionSourceFromDisk(payload: {
  relPath: string;
  source: string;
  entityName?: string;
  solutionPath?: string;
}): string {
  const resolved = resolveFunctionSourcePaths(payload);
  const readCandidates = [resolved.preferredPath, resolved.fallbackPath, resolved.legacyPath];
  for (const candidate of readCandidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate, "utf8");
    }
  }
  return "";
}

function writeFunctionSourceToDisk(payload: {
  relPath: string;
  source: string;
  content: string;
  entityName?: string;
  solutionPath?: string;
  createOnly?: boolean;
}): string {
  const resolved = resolveFunctionSourcePaths(payload);
  const content = typeof payload.content === "string" ? payload.content : "";
  if (payload.createOnly && [resolved.preferredPath, resolved.fallbackPath, resolved.legacyPath].some((candidate) => fs.existsSync(candidate))) {
    throw new Error("Function source already exists. Choose another name.");
  }
  fs.mkdirSync(path.dirname(resolved.preferredPath), { recursive: true });
  fs.writeFileSync(resolved.preferredPath, content, { encoding: "utf8", flag: payload.createOnly ? "wx" : "w" });

  if (resolved.legacyPath !== resolved.preferredPath && fs.existsSync(resolved.legacyPath)) {
    try {
      fs.unlinkSync(resolved.legacyPath);
    } catch {
      // ignore
    }
  }

  return resolved.preferredPath;
}

function renameFunctionSourceOnDisk(payload: {
  relPath: string;
  fromSource: string;
  toSource: string;
  entityName?: string;
  solutionPath?: string;
}): { fromPath: string; toPath: string; skipped: boolean } {
  const fromPaths = resolveFunctionSourcePaths({
    relPath: payload.relPath,
    source: payload.fromSource,
    entityName: payload.entityName,
    solutionPath: payload.solutionPath,
  });
  const toPaths = resolveFunctionSourcePaths({
    relPath: payload.relPath,
    source: payload.toSource,
    entityName: payload.entityName,
    solutionPath: payload.solutionPath,
  });

  const fromCandidates = [fromPaths.preferredPath, fromPaths.fallbackPath, fromPaths.legacyPath];
  const fromPath = fromCandidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || fromPaths.preferredPath;
  if (!fs.existsSync(fromPath)) {
    return { fromPath, toPath: toPaths.preferredPath, skipped: true };
  }

  fs.mkdirSync(path.dirname(toPaths.preferredPath), { recursive: true });
  fs.renameSync(fromPath, toPaths.preferredPath);
  return { fromPath, toPath: toPaths.preferredPath, skipped: false };
}

function deleteFunctionSourceOnDisk(payload: {
  relPath: string;
  source: string;
  entityName?: string;
  solutionPath?: string;
}): string {
  const resolved = resolveFunctionSourcePaths(payload);
  const deleteCandidates = [resolved.preferredPath, resolved.fallbackPath, resolved.legacyPath];
  const filePath = deleteCandidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!filePath) {
    throw new Error("Script not found.");
  }
  fs.unlinkSync(filePath);
  return filePath;
}

function normalizeFolderRelativePath(value: string): string {
  const normalized = `${value || ""}`.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
  if (!normalized) {
    throw new Error("Folder path is required.");
  }
  if (normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Folder path must not contain empty segments, '.' or '..'.");
  }
  return normalized;
}

function readSolutionConfig(solutionPath?: string | null): { solutionRoot: string; modelPath: string } {
  const normalizedSolutionPath = normalizeExistingFilePath(`${solutionPath || backendSolutionPath || currentSolutionPath || ""}`.trim());
  const raw = fs.readFileSync(normalizedSolutionPath, "utf8");
  const parsed = JSON.parse(raw);
  const modelPath = typeof parsed?.modelPath === "string" && parsed.modelPath.trim() ? parsed.modelPath.trim() : "Model";
  return {
    solutionRoot: path.dirname(normalizedSolutionPath),
    modelPath,
  };
}

function updateFolderPropertiesSubtree(modelRootDir: string, subtreeRootDir: string): void {
  const stack = [subtreeRootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name !== ".properties.json") continue;

      try {
        const raw = fs.readFileSync(absPath, "utf8");
        const parsed = JSON.parse(raw);
        const relFolderPath = path
          .relative(modelRootDir, path.dirname(absPath))
          .split(path.sep)
          .join("/")
          .replace(/^\/+|\/+$/g, "");
        const folderName = relFolderPath.split("/").filter(Boolean).pop() || "";

        let changed = false;
        if (Array.isArray(parsed?.folders) && parsed.folders.length > 0 && parsed.folders[0] && typeof parsed.folders[0] === "object") {
          if (parsed.folders[0].path !== relFolderPath) {
            parsed.folders[0].path = relFolderPath;
            changed = true;
          }
          if (folderName && parsed.folders[0].name !== folderName) {
            parsed.folders[0].name = folderName;
            changed = true;
          }
        }
        if (typeof parsed?.path === "string" && parsed.path !== relFolderPath) {
          parsed.path = relFolderPath;
          changed = true;
        }
        if (folderName && typeof parsed?.name === "string" && parsed.name !== folderName) {
          parsed.name = folderName;
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(absPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
        }
      } catch {
        // Ignore malformed files; backend reload will surface parse errors if relevant.
      }
    }
  }
}

function renameFolderOnDisk(payload: { fromFolderPath: string; toFolderPath: string; solutionPath?: string }): { fromPath: string; toPath: string } {
  const fromFolderPath = normalizeFolderRelativePath(payload.fromFolderPath);
  const toFolderPath = normalizeFolderRelativePath(payload.toFolderPath);
  if (fromFolderPath === toFolderPath) {
    return { fromPath: fromFolderPath, toPath: toFolderPath };
  }

  const { solutionRoot, modelPath } = readSolutionConfig(payload.solutionPath);
  const modelRootDir = path.resolve(solutionRoot, modelPath);
  const fromDir = path.resolve(modelRootDir, ...fromFolderPath.split("/"));
  const toDir = path.resolve(modelRootDir, ...toFolderPath.split("/"));
  const modelRootResolved = path.resolve(modelRootDir);
  const fromResolved = path.resolve(fromDir);
  const toResolved = path.resolve(toDir);

  if (!fromResolved.startsWith(`${modelRootResolved}${path.sep}`) || !toResolved.startsWith(`${modelRootResolved}${path.sep}`)) {
    throw new Error("Folder rename path escapes model directory.");
  }
  if (!fs.existsSync(fromResolved) || !fs.statSync(fromResolved).isDirectory()) {
    throw new Error(`Source folder not found: ${fromResolved}`);
  }
  if (fs.existsSync(toResolved)) {
    throw new Error(`Target folder already exists: ${toResolved}`);
  }

  fs.mkdirSync(path.dirname(toResolved), { recursive: true });
  fs.renameSync(fromResolved, toResolved);
  updateFolderPropertiesSubtree(modelRootResolved, toResolved);
  return { fromPath: fromResolved, toPath: toResolved };
}

async function startBackend(solutionPath: string, runtime = resolveBackendRuntime(solutionPath)) {
  if (backendStartPromise) return await backendStartPromise;
  if (backendProcess) throw new Error("Stop the current backend before starting another process.");
  backendStartPromise = (async () => {
    const targetSolutionPath = solutionPath;
    const { pythonPath, moduleName: backendModule, source } = runtime;
    backendWorkspaceId = null;
    backendRuntime = runtime;
    const startupAbort = new AbortController();
    backendStartupAbort = startupAbort;
    mainWindow?.webContents.send("solution:startup-changed", true);
    const startupDeadline = Date.now() + 60_000;
    const token = backendToken;
    const env = buildPythonEnv(pythonPath, path.join(process.resourcesPath, "python-runtime"));
    const backendOutputPreview = { value: "" };

    console.log(`[datam8] Starting backend for ${JSON.stringify(targetSolutionPath)}: Python=${JSON.stringify(pythonPath)} (source: ${source}), module=${backendModule}.`);

    const proc = spawn(
      pythonPath,
      [
        "-u",
        "-m",
        backendModule,
        "serve",
        "--workspace-switch",
        "--host",
        BACKEND_HOST,
        "--port",
        `${BACKEND_PORT}`,
        "--token",
        token,
        "--solution",
        targetSolutionPath,
        "--log-level",
        "warning",
      ],
      {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    proc.stdin.end();
    backendProcess = proc;
    if (updateDemo && process.connected) process.send?.({ type: "backend", pid: proc.pid });
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => appendOutputPreview(backendOutputPreview, "stdout", chunk));
    proc.stderr.on("data", (chunk) => appendOutputPreview(backendOutputPreview, "stderr", chunk));
    proc.stderr.pipe(process.stderr);

    let isStartupPhase = true;
    proc.once("exit", (code, signal) => {
      if (updateDemo && process.connected) process.send?.({ type: "backend-stopped", pid: proc.pid });
      const wasActiveProcess = backendProcess === proc;
      if (wasActiveProcess) {
        backendProcess = null;
        backendBaseUrl = null;
        backendVersion = null;
        backendSolutionPath = null;
        backendWorkspaceId = null;
        backendRuntime = null;
      }
      if (isQuitting || !wasActiveProcess || isStartupPhase) return;

      const output = backendOutputPreview.value.trim();
      const message = [
        "The backend process exited unexpectedly.",
        "",
        `Exit: code=${code ?? "null"}, signal=${signal ?? "null"}`,
        ...(output ? ["", "Backend output (preview):", output] : []),
        "",
        updateDemo ? "Close this simulation and open a fresh one through Developer Tools." : "Do you want to relaunch the app?",
      ].join("\n");
      const result = dialog.showMessageBoxSync({
        type: "error",
        title: "Backend crashed",
        message,
        buttons: updateDemo ? ["Close Simulation"] : ["Relaunch", "Quit"],
        defaultId: 0,
        cancelId: updateDemo ? 0 : 1,
      });
      if (result === 0 && !updateDemo) {
        app.relaunch();
        app.exit(0);
        return;
      }
      app.quit();
    });

    try {
      // Only the process we started can establish readiness. Another service
      // may already occupy the port and must neither be stopped nor adopted.
      const ready = await waitForBackendReady(proc, startupDeadline - Date.now(), startupAbort.signal);
      backendBaseUrl = ready.baseUrl;
      backendVersion = ready.version;
      backendSolutionPath = targetSolutionPath;
      await waitForBackendHealth(backendBaseUrl, token, Math.max(1, startupDeadline - Date.now()), startupAbort.signal);
      const init = { signal: AbortSignal.any([startupAbort.signal, AbortSignal.timeout(Math.max(1, startupDeadline - Date.now()))]) };
      const workspace = await backendRequestJson<{ workspaceId: string }>("/workspace", init);
      backendWorkspaceId = workspace.workspaceId;
      isStartupPhase = false;
    } catch (err) {
      await stopBackend();
      backendWorkspaceId = null;
      backendRuntime = null;
      const msg = err instanceof Error ? err.message : String(err);
      const output = backendOutputPreview.value.trim();
      throw new Error(withOpenSolutionPrefix(simplifyBackendErrorMessage(msg, output)));
    } finally {
      if (backendStartupAbort === startupAbort) {
        backendStartupAbort = null;
        mainWindow?.webContents.send("solution:startup-changed", false);
      }
    }
  })();

  try {
    await backendStartPromise;
  } finally {
    backendStartPromise = null;
  }
}

async function forceReload() {
  const savedPath = currentSolutionPath ?? undefined;
  await stopBackend();
  if (savedPath) {
    await startBackend(savedPath);
    syncWindowTitle();
  }
  if (mainWindow) {
    if (savedPath) {
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow?.webContents.send("solution:open-path", savedPath);
      });
    }
    mainWindow.webContents.reload();
  }
}

function setupMenu() {
  const isMac = process.platform === "darwin";
  const menuItem = <T extends MenuItemConstructorOptions>(item: T): MenuItemConstructorOptions => item;
  const editSubmenu: MenuItemConstructorOptions[] = [
    menuItem({ role: "undo" }),
    menuItem({ role: "redo" }),
    menuItem({ type: "separator" }),
    menuItem({ role: "cut" }),
    menuItem({ role: "copy" }),
    menuItem({ role: "paste" }),
    ...(isMac ? [menuItem({ role: "pasteAndMatchStyle" })] : []),
    menuItem({ role: "delete" }),
    menuItem({ role: "selectAll" }),
    ...(isMac ? [menuItem({ type: "separator" }), menuItem({ role: "startSpeaking" }), menuItem({ role: "stopSpeaking" })] : []),
  ];
  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      label: "Reload",
      accelerator: "CmdOrCtrl+R",
      click: () => { if (!preparingUpdate) mainWindow?.webContents.send("solution:reload", false); },
    },
    {
      label: "Force Reload",
      accelerator: "CmdOrCtrl+Shift+R",
      click: () => { if (!preparingUpdate) mainWindow?.webContents.send("solution:reload", true); },
    },
    menuItem({ role: "toggleDevTools" }),
    menuItem({ type: "separator" }),
    menuItem({ role: "resetZoom" }),
    menuItem({ role: "zoomIn" }),
    menuItem({ role: "zoomOut" }),
    menuItem({ type: "separator" }),
    menuItem({ role: "togglefullscreen" }),
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
        {
          label: app.getName(),
          submenu: [
            menuItem({ role: "about" }),
            menuItem({ type: "separator" }),
            menuItem({ role: "services" }),
            menuItem({ type: "separator" }),
            menuItem({ role: "hide" }),
            menuItem({ role: "hideOthers" }),
            menuItem({ role: "unhide" }),
            menuItem({ type: "separator" }),
            menuItem({ role: "quit" }),
          ],
        },
      ]
      : []),
    {
      label: "File",
      submenu: [isMac ? menuItem({ role: "close" }) : menuItem({ role: "quit" })],
    },
    {
      label: "Edit",
      submenu: editSubmenu,
    },
    {
      label: "View",
      submenu: viewSubmenu,
    },
    {
      label: "Help",
      submenu: [
        { label: "Check for Updates…", click: () => { void updates?.check().catch(reportUpdateError); } },
        { type: "separator" },
        {
          label: "Learn More",
          click: async () => {
            await shell.openExternal("https://github.com/oraylis/datam8-frontend");
          },
        },
        { type: "separator" },
        {
          label: `About ${APP_DISPLAY_NAME}`,
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: `About ${APP_DISPLAY_NAME}`,
              message: `${APP_DISPLAY_NAME}`,
              detail: `Version ${app.getVersion()}`,
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];
  if (!app.isPackaged) template.push({ label: "Developer", submenu: [
    { label: "Developer Tools…", click: () => mainWindow?.webContents.send("developer:open-panel") },
  ] });

  applicationMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(applicationMenu);
}

async function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  if (!backendBaseUrl) {
    backendBaseUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
  }

  const existingWindow = BrowserWindow.getAllWindows().at(0) ?? null;
  if (existingWindow) {
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
    mainWindow = existingWindow;
    return;
  }

  let iconPath: string | undefined = undefined;
  if (process.platform === "win32") {
    iconPath = app.isPackaged
      ? path.join(process.resourcesPath, "assets", "icons", "icon.ico")
      : path.join(app.getAppPath(), "build", "icons", "icon.ico");
  } else if (process.platform === "linux") {
    iconPath = path.join(process.resourcesPath, "assets", "icons", "linux", "icon.png");
  }

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 760,
    title: computeWindowTitle(currentSolutionPath),
    titleBarStyle: process.platform === "win32" ? "hidden" : "default",
    ...(process.platform === "win32"
      ? {
        titleBarOverlay: {
          color: getWindowsChromeColors(resolvedAppTheme(currentAppTheme)).overlayColor,
          symbolColor: getWindowsChromeColors(resolvedAppTheme(currentAppTheme)).symbolColor,
          height: 36,
        },
        autoHideMenuBar: true,
        backgroundColor: getWindowsChromeColors(resolvedAppTheme(currentAppTheme)).backgroundColor,
      }
      : {}),
    trafficLightPosition: undefined,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      additionalArguments: [
        ...(!app.isPackaged ? ["--datam8-development=1"] : []),
        `--datam8-api-base=${backendBaseUrl}`,
        `--datam8-token=${backendToken}`,
        ...(backendVersion ? [`--datam8-backend-version=${backendVersion}`] : []),
      ],
    },
  });

  if (process.platform === "win32") {
    mainWindow.setAutoHideMenuBar(true);
    mainWindow.setMenuBarVisibility(false);
    syncWindowsTitleBarTheme(mainWindow);
  }

  if (!app.isPackaged) {
    const devUrl = "http://localhost:4320";
    const loadDev = () => {
      mainWindow?.loadURL(devUrl).catch((err) => {
        console.log(`Failed to load ${devUrl}: ${err.message}. Retrying in 1s...`);
        setTimeout(loadDev, 1000);
      });
    };
    loadDev();
    // CDP launcher tests must not also attach to a DevTools frontend target.
    if (isDevToolsAllowed() && !updateDemo && process.env.DATAM8_DEVELOPER_TEST_DEBUG !== "1") {
      mainWindow.webContents.openDevTools();
    }
  } else {
    const indexPath = path.join(app.getAppPath(), "web", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    syncWindowTitle();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  syncWindowTitle();
}

function reportUpdateError(error: unknown) { console.warn("[Main] Update operation failed:", error instanceof Error ? error.message : String(error)); }

async function prepareUpdate(): Promise<UpdatePreparation> {
  if (!mainWindow || solutionOperations || backendStartPromise) return { ok: false, reason: "Wait for solution operations or generation to finish, then try again." };
  preparingUpdate = true;
  const id = crypto.randomUUID();
  return new Promise(resolve => {
    const timeout = setTimeout(() => finish({ ok: false, reason: "The editor did not finish its save checks. Please try again." }), 60_000);
    const finish = (result: UpdatePreparation) => { clearTimeout(timeout); preparation = null; resolve(result); };
    preparation = { id, resolve: finish };
    mainWindow?.webContents.send("updates:prepare-install", id);
  });
}

function wireUpdates() {
  if (process.platform === "win32") app.setAppUserModelId("com.datam8");
  const windows = app.isPackaged && process.platform === "win32";
  if (windows) {
    if (process.env.DATAM8_UPDATE_TEST_FEED) autoUpdater.setFeedURL({ provider: "generic", url: loopback(process.env.DATAM8_UPDATE_TEST_FEED) });
    autoUpdater.logger = null;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = Boolean(parseVersion(app.getVersion())?.pre.length);
    autoUpdater.allowDowngrade = false;
    // 'error' must have a listener even though each public operation handles its rejection.
    autoUpdater.on("error", error => {
      reportUpdateError(error);
      if (installingUpdate && !isQuitting) {
        installingUpdate = false;
        updates?.installationFailed(error);
      }
    });
    autoUpdater.on("download-progress", progress => updates?.progress(progress.percent));
  }
  updates = new DesktopUpdates({
    currentVersion: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged, demo: updateDemo,
    releasesApi: updateDemo ? process.env.DATAM8_UPDATE_DEMO_API : process.env.DATAM8_UPDATE_TEST_RELEASES,
    showDialog: async options => {
      const result = mainWindow ? await dialog.showMessageBox(mainWindow, options) : await dialog.showMessageBox(options);
      return result.response;
    },
    publish: status => mainWindow?.webContents.send("updates:status-changed", status),
    progress: fraction => { if (process.platform === "win32" || updateDemo) mainWindow?.setProgressBar(fraction); },
    openExternal: url => shell.openExternal(url),
    checkWindows: async tag => {
      requireWindowsPublisher(fs.readFileSync(path.join(process.resourcesPath, "app-update.yml"), "utf8"));
      releaseUrl(tag); // Validate the tag before constructing its official asset URL.
      const feed = process.env.DATAM8_UPDATE_TEST_FEED ? loopback(process.env.DATAM8_UPDATE_TEST_FEED) : `${REPOSITORY}/releases/download/${encodeURIComponent(tag)}`;
      // Bind download metadata to the same tag as the displayed notes. All our
      // Windows builds emit latest.yml, including beta builds.
      autoUpdater.setFeedURL({ provider: "generic", url: feed });
      autoUpdater.channel = "latest";
      autoUpdater.allowDowngrade = false;
      const result = await autoUpdater.checkForUpdates(); return result?.updateInfo.version || null;
    },
    downloadWindows: async () => { if (!windows) throw new Error("Automatic installation is only available in the installed Windows app."); await autoUpdater.downloadUpdate(); },
    prepare: prepareUpdate, stopBackend,
    installWindows: () => { installingUpdate = true; autoUpdater.quitAndInstall(true, true); },
    releasePreparation: () => { if (!installingUpdate) preparingUpdate = false; },
  });
}

function requireDeveloper(event: IpcMainInvokeEvent, simulation = false) {
  if (!development) throw new Error("Developer tools are unavailable.");
  development.assertDeveloperAccess({ packaged: app.isPackaged, simulation: updateDemo, quitting: isQuitting }, event.sender, mainWindow?.webContents, simulation);
  return development;
}
ipcMain.handle("developer:capabilities", event => {
  const { examplePython, exampleSetup } = requireDeveloper(event);
  const python = examplePython(path.resolve(app.getAppPath(), "../.."));
  return { simulation: updateDemo, exampleAvailable: Boolean(python), exampleReason: python ? undefined : exampleSetup };
});
ipcMain.handle("developer:open-panel", event => { requireDeveloper(event); mainWindow?.webContents.send("developer:open-panel"); });
ipcMain.handle("developer:open-simulation", async event => {
  requireDeveloper(event);
  if (!developerSimulation) throw new Error("Already in an update simulation.");
  await developerSimulation.open();
});
ipcMain.handle("developer:run-scenario", async (event, scenario: unknown, system: unknown) => {
  const { simulationChoice } = requireDeveloper(event, true);
  const choice = simulationChoice(scenario, system);
  if (!updates?.canChangeScenario) throw new Error("Wait for the current update operation to finish.");
  await updates.demoScenario(choice.scenario, choice.windows);
});
ipcMain.handle("developer:open-example", async event => {
  const { examplePython, exampleSetup } = requireDeveloper(event, true);
  if (!examplePython(path.resolve(app.getAppPath(), "../.."))) { await dialog.showMessageBox(mainWindow!, { title: "Example solution", message: "Generator environment is required", detail: exampleSetup, buttons: ["OK"] }); return; }
  if (preparingUpdate || solutionOperations) throw new Error("Wait for the current operation to finish.");
  mainWindow?.webContents.send("solution:open-path", process.env.DATAM8_UPDATE_DEMO_SOLUTION);
});

ipcMain.handle("updates:get-status", () => updates?.status);
ipcMain.handle("updates:check", () => updates?.check());
ipcMain.handle("updates:download", () => updates?.download());
ipcMain.handle("updates:install", () => updates?.install());
ipcMain.handle("updates:open-release", () => updates?.openRelease());
ipcMain.handle("updates:preparation-complete", (event, id: unknown, result: UpdatePreparation) => {
  if (event.sender !== mainWindow?.webContents || !preparation || id !== preparation.id) return;
  preparation.resolve({ ok: result?.ok === true, reason: typeof result?.reason === "string" ? result.reason.slice(0, 1000) : undefined });
});

function handleSolutionOperation<Args extends unknown[], Result>(channel: string, handler: (event: IpcMainInvokeEvent, ...args: Args) => Result | Promise<Result>) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (preparingUpdate || isQuitting) throw new Error("An update or shutdown is in progress. Please try again later.");
    if (solutionOperations) throw new Error("Wait for the current solution operation to finish.");
    solutionOperations++;
    try { return await handler(event, ...args as Args); }
    finally { solutionOperations--; }
  });
}

// Single Instance Lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const file = commandLine.find((arg) => arg.endsWith(".dm8s"));
    if (file) {
      mainWindow.webContents.send("solution:open-path", file);
    }
  });
}

ipcMain.handle("solution:pick-open-path", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "DataM8 Solutions", extensions: ["dm8s"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("solution:pick-save-path", async () => {
  const result = await dialog.showSaveDialog({
    title: "Create New DataM8 Solution",
    filters: [{ name: "DataM8 Solutions", extensions: ["dm8s"] }],
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle("solution:pick-directory", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("solution:pick-plugin-artifacts", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Plugin Artifacts", extensions: ["whl", "zip"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return [];
  return result.filePaths;
});

ipcMain.handle("solution:detect-version", (_event, solutionPath: string | null | undefined) => {
  const normalized = normalizeExistingFilePath(`${solutionPath || ""}`);
  return { version: detectSolutionVersion(normalized), path: normalized };
});

ipcMain.handle("solution:cancel-start", async () => {
  if (!backendStartupAbort) return false;
  backendStartupAbort.abort(new Error("Backend startup cancelled."));
  await backendStartPromise?.catch(() => {});
  return true;
});
ipcMain.handle("solution:is-starting", () => backendStartupAbort !== null);

handleSolutionOperation("solution:load", async (_event, solutionPath: string | null | undefined) => {
  const normalized = normalizeExistingFilePath(`${solutionPath || ""}`);
  await ensureBackendForSolution(normalized);
  const payload = await loadCurrentSolutionPayload();
  return { path: normalized, payload, workspaceId: backendWorkspaceId };
});

handleSolutionOperation("solution:force-reload", forceReload);

handleSolutionOperation("solution:create-new", async (_event, payload: { saveDir: string; solutionName: string; basePath?: string; modelPath?: string }) => {
  const solutionPath = await createSolutionViaCli(payload);
  return { solutionPath };
});

handleSolutionOperation("solution:migrate-v1-to-v2", async (_event, payload: { sourceSolutionPath: string; targetDir: string }) => {
  const migratedSolutionPath = await migrateSolutionViaCli(payload);
  return { solutionPath: migratedSolutionPath };
});

handleSolutionOperation("solution:import-plugins", async (_event, payload: { solutionPath: string; artifactPaths: string[] }) => {
  const imported = importPluginArtifacts(payload);
  await ensureBackendForSolution(payload.solutionPath);
  await backendRequestJson("/plugins/reload", { method: "POST" });
  const plugins = await backendRequestJson("/plugins");
  return { imported, plugins };
});

ipcMain.handle(
  "backend:function-request",
  async (_event, payload: {
    path: string;
    workspaceId?: string | null;
    method?: "GET" | "POST";
    body?: unknown;
    legacySource?: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string };
  }) => {
    const requestPath = `${payload?.path || ""}`;
    if (backendWorkspaceId && payload.workspaceId !== backendWorkspaceId) throw new Error("Workspace changed; reload before retrying.");
    if (!requestPath.startsWith("/functions/")) {
      throw new Error("Only Function API requests are allowed through this bridge.");
    }
    const method = payload?.method || "GET";
    const init: RequestInit = { method };
    if (payload?.body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(payload.body);
    }
    try {
      return await backendRequestJson<unknown>(requestPath, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canMigrateLegacySource =
        method === "POST" &&
        !requestPath.endsWith("/move") &&
        payload?.legacySource &&
        /Response404NotFound|source file|not found/i.test(message);
      if (!canMigrateLegacySource) throw error;

      writeFunctionSourceToDisk(payload.legacySource!);
      return await backendRequestJson<unknown>(requestPath, init);
    }
  },
);

ipcMain.handle(
  "solution:read-function-source",
  (_event, payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) => {
    const content = readFunctionSourceFromDisk(payload);
    return { content };
  },
);

ipcMain.handle(
  "solution:save-function-source",
  (_event, payload: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string; createOnly?: boolean }) => {
    const filePath = writeFunctionSourceToDisk(payload);
    return { path: filePath };
  },
);

ipcMain.handle(
  "solution:rename-function-source",
  (_event, payload: { relPath: string; fromSource: string; toSource: string; entityName?: string; solutionPath?: string }) => {
    return renameFunctionSourceOnDisk(payload);
  },
);

ipcMain.handle(
  "solution:delete-function-source",
  (_event, payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) => {
    const filePath = deleteFunctionSourceOnDisk(payload);
    return { path: filePath };
  },
);

ipcMain.handle(
  "solution:rename-folder",
  (_event, payload: { fromFolderPath: string; toFolderPath: string; solutionPath?: string }) => {
    return renameFolderOnDisk(payload);
  },
);

handleSolutionOperation(
  "solution:generate",
  async (_event, payload: { solutionPath: string; target: string; logLevel?: string; cleanOutput?: boolean }) => {
    return await generateSolutionViaCli(payload);
  },
);

ipcMain.handle("window:set-solution-path", (_event, solutionPath: string | null | undefined) => {
  const normalized = typeof solutionPath === "string" ? solutionPath.trim() : "";
  currentSolutionPath = normalized || null;
  syncWindowTitle();
  return true;
});

ipcMain.handle("window:get-title", () => computeWindowTitle(currentSolutionPath));

ipcMain.handle("menu:get-top-level-labels", () => {
  const items = applicationMenu?.items ?? [];
  return items
    .filter((item) => item.visible !== false && typeof item.label === "string" && item.label.trim())
    .map((item) => item.label);
});

ipcMain.handle("menu:popup-submenu", (_event, label: string | null | undefined, x: number, y: number) => {
  if (!mainWindow || !applicationMenu) return false;
  const targetLabel = typeof label === "string" ? label.trim() : "";
  if (!targetLabel) return false;
  const item = applicationMenu.items.find((entry) => entry.label === targetLabel && entry.submenu);
  if (!item?.submenu) return false;
  item.submenu.popup({
    window: mainWindow,
    x: Math.round(x),
    y: Math.round(y),
  });
  return true;
});

ipcMain.handle("theme:get-current", () => currentAppTheme);

ipcMain.handle("theme:set-current", (_event, theme: string | null | undefined) => {
  currentAppTheme = theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
  syncWindowsTitleBarTheme(mainWindow, currentAppTheme);
  return true;
});

nativeTheme.on("updated", () => {
  const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
  if (!mainWindow) return;
  syncWindowsTitleBarTheme(mainWindow, currentAppTheme);
  mainWindow?.webContents.send("theme:changed", theme);
});

if (gotLock) {
  if (!app.isPackaged) {
    const quitDevelopment = () => { developmentShutdown = true; app.quit(); };
    process.on("SIGTERM", quitDevelopment);
    process.on("SIGINT", quitDevelopment);
    if (!updateDemo && typeof process.send === "function") {
      // Only the owning development launcher has this process IPC channel.
      process.on("message", message => {
        if (message && typeof message === "object" && "type" in message && message.type === "development:shutdown") quitDevelopment();
      });
      process.once("disconnect", quitDevelopment);
    }
  }
  if (updateDemo) {
    process.on("message", message => {
      const kind = (message as { type?: string }).type;
      if (kind === "shutdown") app.quit();
      if (kind === "focus") { if (mainWindow?.isMinimized()) mainWindow.restore(); mainWindow?.show(); mainWindow?.focus(); }
    });
    process.on("disconnect", () => {
      if (!isQuitting && process.env.DATAM8_UPDATE_DEMO_PROFILE) {
        const cleanup = spawn(process.execPath, [path.join(app.getAppPath(), "resources/cleanup-dev-profile.cjs"), path.dirname(process.env.DATAM8_UPDATE_DEMO_PROFILE), String(process.pid)], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: undefined }, detached: true, stdio: "ignore" });
        cleanup.on("error", reportUpdateError); cleanup.unref();
      }
      app.quit();
    });
  }
  app.whenReady().then(async () => {
    setupMenu();
    await createWindow();
    wireUpdates();
    if (updateDemo && process.connected) process.send?.({ type: "ready" });
    else if (updateDemo) app.quit();

    if (process.platform !== "darwin") {
      const file = process.argv.find((arg) => arg.endsWith(".dm8s"));
      if (file && mainWindow) {
        mainWindow.webContents.once("did-finish-load", () => {
          mainWindow?.webContents.send("solution:open-path", file);
        });
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow();
    });
  });

  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    if (mainWindow) {
      mainWindow.webContents.send("solution:open-path", filePath);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("before-quit", event => {
    if (shutdownComplete) return;
    event.preventDefault();
    if (isQuitting) return;
    isQuitting = true;
    void Promise.all([stopBackend(), developerSimulation?.close()]).then(() => {
      shutdownComplete = true;
      // Development restarts must also finish with DevTools open. Exit only
      // after the backend and the isolated simulation have finished cleanup.
      if (!app.isPackaged && developmentShutdown) app.exit(0);
      else app.quit();
    }).catch(error => {
      console.error("Backend shutdown failed:", error);
      app.exit(1);
    });
  });

  app.on("window-all-closed", () => {
    if (updateDemo || process.platform !== "darwin") app.quit();
  });
}
