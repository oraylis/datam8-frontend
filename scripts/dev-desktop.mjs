import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
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
  console.error("- uv sync");
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

if (!fs.existsSync(generatorSrcPath)) {
  console.error(`[dev-desktop] datam8-generator source path not found: ${generatorSrcPath}`);
  process.exit(1);
}

const pythonPath = resolvePythonPath();
if (!pythonPath) {
  process.exit(1);
}

if (!canImportDatam8(pythonPath)) {
  process.exit(1);
}

console.log(`[dev-desktop] Using DATAM8_PYTHON_PATH=${pythonPath}`);
console.log("[dev-desktop] Web UI URL is fixed to http://localhost:4320 (strict port). Electron spawns backend via `python -m datam8 serve`.");

const env = {
  ...process.env,
  VITE_APP_MODE: "electron",
};

const run = spawnSync("npm", ["run", "dev:desktop:source"], {
  cwd: repoRoot,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(run.status ?? 1);
