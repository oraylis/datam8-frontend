import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { watchDesktop } from "./watch-desktop.mjs";
import { startVite } from "./dev-vite.mjs";
import { assertFontAssets } from "./check-font-assets.mjs";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try { assertFontAssets(); }
catch (error) { console.error(error.message); process.exit(1); }
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

const controlledTest = process.env.DATAM8_DEVELOPER_TEST_DEBUG === '1' && !process.stdin.isTTY;
// In acceptance tests the launcher owns stdin; Vite must not also react to its EOF.
const vite = startVite(controlledTest ? { env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'inherit', 'inherit'] } : {});
let desktop, closing;
function close() {
  if (!closing) closing = (async () => {
    try { await desktop?.close(); }
    finally { await vite.close(); }
  })();
  return closing;
}
const shutdown = () => { void close().catch(error => { console.error(error.message); process.exitCode = 1; }); };
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
if (controlledTest) {
  // The launcher acceptance check owns this pipe and closes it to request cleanup.
  process.stdin.once('end', shutdown);
  process.stdin.resume();
}
vite.child.once('error', error => { console.error(error.message); process.exitCode = 1; shutdown(); });
vite.child.once('exit', code => {
  if (!closing && desktop) {
    if (code) process.exitCode = code;
    shutdown();
  }
});
try {
  await vite.ready;
  if (!closing) desktop = watchDesktop({ appDir: path.join(repoRoot, 'apps/desktop') });
} catch (error) {
  if (!closing) { console.error(error.message); process.exitCode = 1; }
  await close();
}
