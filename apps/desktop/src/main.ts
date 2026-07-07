import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell, type MenuItemConstructorOptions } from "electron";
import { autoUpdater } from "electron-updater";
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

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let currentSolutionPath: string | null = null;
let userSettings: UserSettings | null = null;

let backendProcess: ChildProcessWithoutNullStreams | null = null;
let backendBaseUrl: string | null = null;
let backendToken: string | null = crypto.randomBytes(24).toString("hex");
let backendVersion: string | null = null;
let backendStartPromise: Promise<void> | null = null;
let backendSolutionPath: string | null = null;
let currentAppTheme: "light" | "dark" = nativeTheme.shouldUseDarkColors ? "dark" : "light";
let applicationMenu: Menu | null = null;
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 4318;
const BACKEND_OUTPUT_PREVIEW_LIMIT = 8192;

function cleanupStaleBackendOnPort(port: number): void {
  if (process.platform !== "win32") return;
  try {
    const netstat = spawnSync("netstat", ["-ano", "-p", "tcp"], {
      shell: false,
      stdio: "pipe",
      encoding: "utf8",
    });
    const output = `${netstat.stdout || ""}`;
    if (!output) return;

    const pids = new Set<number>();
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (!/\sLISTENING\s/i.test(trimmed)) continue;
      if (!trimmed.includes(`:${port}`)) continue;
      const parts = trimmed.split(/\s+/);
      const pidRaw = parts.at(-1) || "";
      const pid = Number.parseInt(pidRaw, 10);
      if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) continue;
      pids.add(pid);
    }

    for (const pid of pids) {
      // Best effort cleanup: stale python/datam8 listeners can survive electron restarts.
      spawnSync("taskkill", ["/PID", `${pid}`, "/T", "/F"], {
        shell: false,
        stdio: "ignore",
      });
    }
  } catch {
    // Ignore cleanup failures; startup will still attempt to spawn and report errors.
  }
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

function syncWindowsTitleBarTheme(targetWindow: BrowserWindow | null, theme: "light" | "dark" = currentAppTheme) {
  if (!targetWindow || process.platform !== "win32") return;
  const colors = getWindowsChromeColors(theme);
  targetWindow.setBackgroundColor(colors.backgroundColor);
  targetWindow.setTitleBarOverlay({
    color: colors.overlayColor,
    symbolColor: colors.symbolColor,
    height: 36,
  });
}

function computeWindowTitle(solutionPath?: string | null): string {
  const pathPart = (solutionPath || "").trim();
  return pathPart ? `${APP_DISPLAY_NAME} (${pathPart})` : APP_DISPLAY_NAME;
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
      fs.chmodSync(filePath, 0o755);
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

function resolvePythonRuntimePath(): string | null {
  const override = process.env.DATAM8_PYTHON_PATH;
  if (override) {
    console.log("override detected");
    return isRunnablePython(override) ? override : null;
  }

  if (userSettings?.pythonPath) {
    console.log("user setting detected");
    return isRunnablePython(userSettings.pythonPath) ? userSettings.pythonPath : null;
  }

  if (app.isPackaged) {
    console.log("packaged");
    for (const candidate of resolvePackagedPythonCandidates()) {
      if (ensureExecutable(candidate)) return candidate;
    }
    return null;
  }

  const repoRoot = resolveRepoRoot();
  if (repoRoot) {
    console.log("submodule fallback");
    const submoduleRoot = path.join(repoRoot, "submodules", "datam8-generator");
    const devCandidates = process.platform === "win32"
      ? [path.join(submoduleRoot, ".venv", "Scripts", "python.exe")]
      : [path.join(submoduleRoot, ".venv", "bin", "python3"), path.join(submoduleRoot, ".venv", "bin", "python")];
    for (const candidate of devCandidates) {
      if (ensureExecutable(candidate)) return candidate;
    }
  }

  const fallbackCommands = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  for (const candidate of fallbackCommands) {
    if (canRunCommand(candidate)) return candidate;
  }

  return null;
}

function parseReadyLine(line: string): { baseUrl: string; version: string } | null {
  try {
    const data = JSON.parse(line);
    if (!data || typeof data !== "object") return null;
    if (data.type !== "ready") return null;
    if (typeof data.baseUrl !== "string" || !data.baseUrl.trim()) return null;
    const version = typeof data.version === "string" ? data.version : "0.0.0";
    return { baseUrl: data.baseUrl, version };
  } catch {
    // Current datam8 serve emits plain text:
    // "API ready at `http://127.0.0.1:4318`, schemaVersion: 2.0.0"
    const match = line.match(/API ready at\s+`([^`]+)`(?:,\s*schemaVersion:\s*(.+))?/i);
    if (!match) return null;
    const baseUrl = `${match[1] || ""}`.trim();
    if (!baseUrl) return null;
    const version = `${match[2] || "0.0.0"}`.trim() || "0.0.0";
    return { baseUrl, version };
  }
}

async function waitForBackendReady(
  proc: ChildProcessWithoutNullStreams,
  timeoutMs = 20_000,
): Promise<{ baseUrl: string; version: string } | null> {
  return await new Promise((resolve, reject) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let stderrPreview = "";
    let didResolve = false;

    const timeout = setTimeout(() => {
      if (didResolve) return;
      didResolve = true;
      // Not every backend build emits a machine-readable ready line.
      // Caller must fallback to /health probing.
      resolve(null);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout.off("data", onStdout);
      proc.stderr.off("data", onStderr);
      proc.off("exit", onExit);
      proc.off("error", onError);
    };

    const onError = (err: unknown) => {
      if (didResolve) return;
      didResolve = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (didResolve) return;
      didResolve = true;
      cleanup();
      reject(new Error(`Backend exited before readiness. code=${code ?? "null"} signal=${signal ?? "null"}\nStderr (preview):\n${stderrPreview}`));
    };

    const onStderr = (chunk: string) => {
      if (stderrPreview.length < 4096) {
        stderrPreview += chunk.slice(0, 4096 - stderrPreview.length);
      }
      stderrBuf += chunk;
      while (true) {
        const idx = stderrBuf.indexOf("\n");
        if (idx < 0) break;
        const line = stderrBuf.slice(0, idx).trim();
        stderrBuf = stderrBuf.slice(idx + 1);
        if (!line) continue;
        const ready = parseReadyLine(line);
        if (ready) {
          if (didResolve) return;
          didResolve = true;
          cleanup();
          resolve(ready);
          return;
        }
        const uvicornMatch = line.match(/Uvicorn running on (https?:\/\/[^\s]+)\s*/i);
        if (uvicornMatch?.[1]) {
          if (didResolve) return;
          didResolve = true;
          cleanup();
          resolve({ baseUrl: uvicornMatch[1].trim().replace(/\/+$/, ""), version: "0.0.0" });
          return;
        }
      }
    };

    const onStdout = (chunk: string) => {
      stdoutBuf += chunk;
      while (true) {
        const idx = stdoutBuf.indexOf("\n");
        if (idx < 0) return;
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line) continue;
        const ready = parseReadyLine(line);
        if (!ready) continue;
        if (didResolve) return;
        didResolve = true;
        cleanup();
        resolve(ready);
        return;
      }
    };

    proc.once("error", onError);
    proc.once("exit", onExit);
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");
    proc.stderr.on("data", onStderr);
    proc.stdout.on("data", onStdout);
  });
}

async function waitForBackendHealth(baseUrl: string, token: string, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  const headers = { Authorization: `Bearer ${token}` };

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`, { headers });
      if (res.ok) return;
    } catch {
      // Backend may still be booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Backend health timed out after ${timeoutMs}ms`);
}

async function stopBackend() {
  if (!backendProcess) return;
  const proc = backendProcess;
  backendProcess = null;
  backendBaseUrl = null;
  backendVersion = null;
  backendSolutionPath = null;

  try {
    proc.kill();
  } catch {
    // ignore
  }
}

function normalizeExistingFilePath(value: string): string {
  const candidate = `${value || ""}`.trim();
  if (!candidate) {
    throw new Error("Solution path is required.");
  }
  const absolute = path.resolve(candidate);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Solution file not found: ${absolute}`);
  }
  if (!absolute.toLowerCase().endsWith(".dm8s")) {
    throw new Error("Expected a .dm8s solution file.");
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
  try {
    const raw = fs.readFileSync(solutionFilePath, "utf8");
    const parsed = JSON.parse(raw);
    const schemaVersion = typeof parsed?.schemaVersion === "string" ? parsed.schemaVersion.trim() : "";
    return schemaVersion ? "v2" : "v1";
  } catch {
    // If unreadable/unparseable we let the backend report a detailed error later.
    return "v1";
  }
}

async function backendRequestJson<T>(relativePath: string, init?: RequestInit): Promise<T> {
  if (!backendBaseUrl || !backendToken) {
    throw new Error("Backend is not running.");
  }
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${backendToken}`);
  const response = await fetch(`${backendBaseUrl}${relativePath}`, { ...(init || {}), headers });
  const data = await response.json().catch(() => ({}));
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
  if (backendProcess && backendSolutionPath && path.resolve(backendSolutionPath) === normalized) {
    if (backendBaseUrl && backendToken) {
      try {
        await waitForBackendHealth(backendBaseUrl, backendToken, 2_500);
        return;
      } catch {
        // Existing process is stale/unreachable; restart below.
      }
    }
  }
  await stopBackend();
  currentSolutionPath = normalized;
  await startBackend(normalized);
  syncWindowTitle();
}

function runPythonCli(
  pythonPath: string,
  backendModule: string,
  args: string[],
): { stdout: string; stderr: string } {
  const result = spawnSync(pythonPath, ["-m", backendModule, ...args], {
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

  const solutionDir = path.join(saveDir, solutionName);
  const solutionFile = path.join(solutionDir, `${solutionName}.dm8s`);
  fs.mkdirSync(solutionDir, { recursive: true });

  const pythonPath = resolvePythonRuntimePath();
  if (!pythonPath) throw new Error("Python runtime not found.");
  const backendModule = (process.env.DATAM8_BACKEND_MODULE || "datam8").trim() || "datam8";
  runPythonCli(pythonPath, backendModule, ["init", solutionName, "--solution", solutionFile]);

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

  const pythonPath = resolvePythonRuntimePath();
  if (!pythonPath) throw new Error("Python runtime not found.");
  const backendModule = (process.env.DATAM8_BACKEND_MODULE || "datam8").trim() || "datam8";
  runPythonCli(pythonPath, backendModule, [
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

async function validateSolutionViaCli(params: { solutionPath: string; logLevel?: string }): Promise<{ success: boolean; message: string; messages: string[] }> {
  const solutionPath = normalizeExistingFilePath(params.solutionPath);
  const pythonPath = resolvePythonRuntimePath();
  if (!pythonPath) throw new Error("Python runtime not found.");
  const backendModule = (process.env.DATAM8_BACKEND_MODULE || "datam8").trim() || "datam8";

  const args = ["validate", "--solution", solutionPath];
  const logLevel = `${params.logLevel || ""}`.trim();
  if (logLevel) {
    args.push("--log-level", logLevel);
  }
  const result = runPythonCli(pythonPath, backendModule, args);
  const deduped = parseCliOutputLines(result);
  return {
    success: true,
    message: deduped[0] || "Validation successful.",
    messages: deduped.length ? deduped : ["Validation successful."],
  };
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

  const pythonPath = resolvePythonRuntimePath();
  if (!pythonPath) throw new Error("Python runtime not found.");
  const backendModule = (process.env.DATAM8_BACKEND_MODULE || "datam8").trim() || "datam8";

  const args = ["generate", target, "--solution", solutionPath];
  const logLevel = `${params.logLevel || ""}`.trim();
  if (logLevel) {
    args.push("--log-level", logLevel);
  }
  // Always clean generator output before rendering to match frontend behavior.
  args.push("--clean-output");
  const result = runPythonCli(pythonPath, backendModule, args);
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
  const preferredPath = path.resolve(entityDir, folderName, source);
  const fallbackPath = path.resolve(entityDir, fallbackFolderName, source);
  const legacyPath = path.resolve(entityDir, source);
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
}): string {
  const resolved = resolveFunctionSourcePaths(payload);
  const content = typeof payload.content === "string" ? payload.content : "";
  fs.mkdirSync(path.dirname(resolved.preferredPath), { recursive: true });
  fs.writeFileSync(resolved.preferredPath, content, "utf8");

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

async function startBackend(solutionPath?: string, tokenOverride?: string) {
  userSettings = null;

  if (backendBaseUrl && backendToken && backendProcess) {
    try {
      await waitForBackendHealth(backendBaseUrl, backendToken, 2_500);
      return;
    } catch {
      await stopBackend();
    }
  }
  if (backendStartPromise) {
    await backendStartPromise;
    return;
  }

  backendStartPromise = (async () => {
    if (backendBaseUrl && backendToken && backendProcess) {
      try {
        await waitForBackendHealth(backendBaseUrl, backendToken, 2_500);
        return;
      } catch {
        await stopBackend();
      }
    }

    const targetSolutionPath = solutionPath || currentSolutionPath || "";
    if (!targetSolutionPath) return;
    const targetSolutionDir = path.dirname(path.resolve(targetSolutionPath));
    userSettings = UserSettings.parseFromSolution(targetSolutionDir);

    const pythonPath = resolvePythonRuntimePath();
    if (!pythonPath) {
      const lines = [
        app.isPackaged ? "Bundled Python runtime for datam8 backend not found." : "Python runtime for datam8 backend not found.",
        "",
        "Fix:",
        ...(app.isPackaged
          ? ["- Reinstall/update the desktop app (package may be incomplete).", "- Or set DATAM8_PYTHON_PATH to a valid Python executable."]
          : ["- Set DATAM8_PYTHON_PATH to a valid Python executable."]),
        "- Ensure the runtime can import the 'datam8' module (wheel installed or PYTHONPATH configured).",
      ];
      throw new Error(lines.join("\n"));
    }
    const backendModule = (process.env.DATAM8_BACKEND_MODULE || userSettings.backendModule || "datam8").trim();
    const token = (tokenOverride || backendToken || "").trim() || crypto.randomBytes(24).toString("hex");
    backendToken = token;
    cleanupStaleBackendOnPort(BACKEND_PORT);
    const env: NodeJS.ProcessEnv = { ...process.env, DATAM8_MODE: "electron" };
    const backendOutputPreview = { value: "" };

    console.log(`[datam8] resolved python path: '${pythonPath}'`);
    console.log(`[datam8] resolved python module: '${backendModule}'`);

    const proc = spawn(
      pythonPath,
      [
        "-m",
        backendModule,
        "serve",
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
    proc.stderr.setEncoding("utf8");
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => appendOutputPreview(backendOutputPreview, "stdout", chunk));
    proc.stderr.on("data", (chunk) => appendOutputPreview(backendOutputPreview, "stderr", chunk));
    proc.stderr.pipe(process.stderr);

    let isStartupPhase = true;
    proc.once("exit", (code, signal) => {
      const wasActiveProcess = backendProcess === proc;
      if (wasActiveProcess) {
        backendProcess = null;
        backendBaseUrl = null;
        backendToken = null;
        backendVersion = null;
        backendSolutionPath = null;
      }
      if (isQuitting || !wasActiveProcess || isStartupPhase) return;

      const output = backendOutputPreview.value.trim();
      const message = [
        "The backend process exited unexpectedly.",
        "",
        `Exit: code=${code ?? "null"}, signal=${signal ?? "null"}`,
        ...(output ? ["", "Backend output (preview):", output] : []),
        "",
        "Do you want to relaunch the app?",
      ].join("\n");
      const result = dialog.showMessageBoxSync({
        type: "error",
        title: "Backend crashed",
        message,
        buttons: ["Relaunch", "Quit"],
        defaultId: 0,
        cancelId: 1,
      });
      if (result === 0) {
        app.relaunch();
        app.exit(0);
        return;
      }
      app.quit();
    });

    try {
      const fallbackBaseUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
      const readyOrHealth = await Promise.race<
        { baseUrl: string; version: string | null } | null
      >([
        waitForBackendReady(proc, 5_000).then((ready) =>
          ready ? { baseUrl: ready.baseUrl, version: ready.version } : null,
        ),
        waitForBackendHealth(fallbackBaseUrl, token, 20_000).then(() => ({
          baseUrl: fallbackBaseUrl,
          version: null,
        })),
      ]);
      backendBaseUrl = readyOrHealth?.baseUrl || fallbackBaseUrl;
      backendVersion = readyOrHealth?.version || null;
      backendSolutionPath = targetSolutionPath;
      await waitForBackendHealth(backendBaseUrl, token);
      const versionPayload = await backendRequestJson<{ appVersion?: string; app_version?: string; schemaVersion?: string; schema_version?: string }>("/version");
      backendVersion = `${versionPayload?.appVersion || versionPayload?.app_version || versionPayload?.schemaVersion || versionPayload?.schema_version || backendVersion || "0.0.0"}`;
      isStartupPhase = false;
    } catch (err) {
      try {
        proc.kill();
      } catch {
        // ignore
      }
      backendProcess = null;
      backendBaseUrl = null;
      backendVersion = null;
      backendSolutionPath = null;
      const msg = err instanceof Error ? err.message : String(err);
      const output = backendOutputPreview.value.trim();
      throw new Error(`Failed to open solution: ${msg}${output ? `\n\nBackend output (preview):\n${output}` : ""}`);
    }
  })();

  try {
    await backendStartPromise;
  } finally {
    backendStartPromise = null;
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
    menuItem({ role: "reload" }),
    {
      label: "Force Reload",
      accelerator: "CmdOrCtrl+Shift+R",
      click: async () => {
        const savedToken = backendToken ?? undefined;
        const savedPath = currentSolutionPath ?? undefined;
        await stopBackend();
        if (savedPath) {
          try {
            await startBackend(savedPath, savedToken);
          } catch (err) {
            dialog.showErrorBox("Force Reload Failed", `Backend failed to restart: ${(err as Error).message}`);
          }
          syncWindowTitle();
        }
        if (mainWindow) {
          // After the renderer finishes reloading, re-send the solution path so
          // the app re-opens the same solution it had before the force reload.
          if (savedPath) {
            mainWindow.webContents.once("did-finish-load", () => {
              mainWindow?.webContents.send("solution:open-path", savedPath);
            });
          }
          mainWindow.webContents.reload();
        }
      },
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
        {
          label: "Learn More",
          click: async () => {
            await shell.openExternal("https://github.com/oraylis/datam8");
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

  applicationMenu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(applicationMenu);
}

async function createWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }

  if (!backendBaseUrl || !backendToken) {
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
    iconPath = path.join(process.resourcesPath, "assets", "icons", "icon.ico");
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
          color: getWindowsChromeColors(currentAppTheme).overlayColor,
          symbolColor: getWindowsChromeColors(currentAppTheme).symbolColor,
          height: 36,
        },
        autoHideMenuBar: true,
        backgroundColor: getWindowsChromeColors(currentAppTheme).backgroundColor,
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
        `--datam8-api-base=${backendBaseUrl}`,
        `--datam8-token=${backendToken || ""}`,
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
    if (isDevToolsAllowed()) {
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

function wireAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err: unknown) => {
    console.warn("[Main] autoUpdater error:", (err as Error)?.message || String(err));
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      console.warn("[Main] checkForUpdates failed:", (err as Error)?.message || String(err));
    });
  };

  check();
  setInterval(check, 6 * 60 * 60 * 1000);
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

ipcMain.handle("solution:load", async (_event, solutionPath: string | null | undefined) => {
  const normalized = normalizeExistingFilePath(`${solutionPath || ""}`);
  await ensureBackendForSolution(normalized);
  const payload = await loadCurrentSolutionPayload();
  return { path: normalized, payload };
});

ipcMain.handle("solution:create-new", async (_event, payload: { saveDir: string; solutionName: string; basePath?: string; modelPath?: string }) => {
  const solutionPath = await createSolutionViaCli(payload);
  await ensureBackendForSolution(solutionPath);
  const loaded = await loadCurrentSolutionPayload();
  return { solutionPath, payload: loaded };
});

ipcMain.handle("solution:migrate-v1-to-v2", async (_event, payload: { sourceSolutionPath: string; targetDir: string }) => {
  const migratedSolutionPath = await migrateSolutionViaCli(payload);
  await ensureBackendForSolution(migratedSolutionPath);
  const loaded = await loadCurrentSolutionPayload();
  return { solutionPath: migratedSolutionPath, payload: loaded };
});

ipcMain.handle("solution:import-plugins", async (_event, payload: { solutionPath: string; artifactPaths: string[] }) => {
  const imported = importPluginArtifacts(payload);
  await ensureBackendForSolution(payload.solutionPath);
  await backendRequestJson("/plugins/reload", { method: "POST" });
  const plugins = await backendRequestJson("/plugins/");
  return { imported, plugins };
});

ipcMain.handle(
  "solution:read-function-source",
  (_event, payload: { relPath: string; source: string; entityName?: string; solutionPath?: string }) => {
    const content = readFunctionSourceFromDisk(payload);
    return { content };
  },
);

ipcMain.handle(
  "solution:save-function-source",
  (_event, payload: { relPath: string; source: string; content: string; entityName?: string; solutionPath?: string }) => {
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

ipcMain.handle(
  "solution:validate",
  async (_event, payload: { solutionPath: string; logLevel?: string }) => {
    return await validateSolutionViaCli(payload);
  },
);

ipcMain.handle(
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

ipcMain.handle("theme:get-current", () => (nativeTheme.shouldUseDarkColors ? "dark" : "light"));

ipcMain.handle("theme:set-current", (_event, theme: string | null | undefined) => {
  currentAppTheme = theme === "light" ? "light" : "dark";
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
  app.whenReady().then(async () => {
    setupMenu();
    await createWindow();
    wireAutoUpdates();

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

  app.on("before-quit", () => {
    isQuitting = true;
    try {
      backendProcess?.kill();
    } catch {
      // ignore
    }
    backendProcess = null;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
