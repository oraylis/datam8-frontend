import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { createRequire } from "node:module";
import { watchDesktop } from "./watch-desktop.mjs";
import { terminateChild } from "../apps/desktop/resources/backend-lifecycle.cjs";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorRoot = path.join(repoRoot, "submodules", "datam8-generator");
const generatorSrcPath = path.join(generatorRoot, "src");
const venvPythonCandidates = process.platform === "win32"
  ? [path.join(generatorRoot, ".venv", "Scripts", "python.exe")]
  : [path.join(generatorRoot, ".venv", "bin", "python3"), path.join(generatorRoot, ".venv", "bin", "python")];

function normalizePathForCompare(filePath) {
  const normalized = path.normalize(path.resolve(filePath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isExistingFile(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function printSetupHints() {
  console.error("Fix:");
  console.error("- cd submodules/datam8-generator");
  console.error("- uv sync --frozen --all-extras");
  console.error("- cd ../..");
  console.error("- npm run dev:desktop");
}

function resolvePythonPath() {
  const override = (process.env.DATAM8_PYTHON_PATH || "").trim();
  const allowedPaths = new Set(venvPythonCandidates.map(normalizePathForCompare));

  if (override) {
    const resolvedOverride = path.resolve(override);
    if (!allowedPaths.has(normalizePathForCompare(resolvedOverride))) {
      console.error("[dev-desktop] DATAM8_PYTHON_PATH must point to the datam8-generator .venv interpreter.");
      console.error("");
      console.error("Expected one of:");
      for (const candidate of venvPythonCandidates) {
        console.error(`- ${candidate}`);
      }
      console.error("");
      printSetupHints();
      return null;
    }

    if (!isExistingFile(resolvedOverride)) {
      console.error(`[dev-desktop] DATAM8_PYTHON_PATH does not exist: ${resolvedOverride}`);
      console.error("");
      printSetupHints();
      return null;
    }
    return resolvedOverride;
  }

  for (const candidate of venvPythonCandidates) {
    if (isExistingFile(candidate)) return candidate;
  }

  console.error("[dev-desktop] datam8-generator .venv Python runtime not found.");
  console.error("");
  console.error("Expected one of:");
  for (const candidate of venvPythonCandidates) {
    console.error(`- ${candidate}`);
  }
  console.error("");
  printSetupHints();
  return null;
}

function canImportDatam8(pythonPath) {
  const probe = spawnSync(pythonPath, ["-m", "datam8", "--help"], {
    cwd: generatorRoot,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 5_000,
  });
  if (probe.error || probe.status !== 0) {
    console.error(`[dev-desktop] Python runtime is not ready for datam8: ${pythonPath}`);
    const detail = (probe.stderr || probe.stdout || "").trim();
    if (detail) {
      console.error("");
      console.error(detail);
    }
    console.error("");
    printSetupHints();
    return false;
  }
  return true;
}

const pythonPath = fs.existsSync(generatorSrcPath) ? resolvePythonPath() : null;
const backendReady = Boolean(pythonPath && canImportDatam8(pythonPath));
if (backendReady) console.log(`[dev-desktop] Using DATAM8_PYTHON_PATH=${pythonPath}`);
else console.warn("[dev-desktop] Starting the frontend without a prepared backend. Developer update simulations remain available; prepare Generator before opening solutions.");
console.log("[dev-desktop] Web UI URL is fixed to http://localhost:4320 (strict port). Electron spawns backend via `python -m datam8 serve`.");

Object.assign(process.env, {
  VITE_APP_MODE: "electron",
  ...(backendReady && pythonPath ? { DATAM8_PYTHON_PATH: pythonPath } : {}),
  ...(process.platform === "win32" ? { PYTHON_KEYRING_BACKEND: "keyring.backends.Windows.WinVaultKeyring" } : {}),
});
if (!backendReady) delete process.env.DATAM8_PYTHON_PATH;

const require = createRequire(path.join(repoRoot, 'apps/web/package.json'));
const vite = spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js')], {
  cwd: path.join(repoRoot, 'apps/web'), stdio: ['inherit', 'pipe', 'pipe'], env: process.env,
});
let desktop, closing, viteReady = false;
vite.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (/http:\/\/localhost:4320\//.test(String(chunk))) viteReady = true;
});
vite.stderr.on('data', chunk => process.stderr.write(chunk));
function close() {
  if (!closing) closing = (async () => { await desktop?.close(); await terminateChild(vite); })();
  return closing;
}
const shutdown = () => { void close().catch(error => { console.error(error.message); process.exitCode = 1; }); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
vite.once('error', error => { console.error(error.message); process.exitCode = 1; shutdown(); });
vite.once('exit', code => { if (!closing && code) process.exitCode = code; shutdown(); });
try {
  const deadline = Date.now() + 30_000;
  while (!closing) {
    if (Date.now() >= deadline) throw new Error('Vite did not start within 30 seconds.');
    try {
      if (viteReady && (await fetch('http://localhost:4320', { signal: AbortSignal.timeout(500) })).ok) {
        desktop = watchDesktop({ appDir: path.join(repoRoot, 'apps/desktop') });
        break;
      }
    } catch { /* Vite is starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; await close(); }
