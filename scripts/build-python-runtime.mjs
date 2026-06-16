import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

function resolveGeneratorExtras(generatorRoot) {
  const pyprojectPath = path.join(generatorRoot, "pyproject.toml");
  if (!fs.existsSync(pyprojectPath)) return [];
  const content = fs.readFileSync(pyprojectPath, "utf8");
  // Parse [project.optional-dependencies] section keys — each key is an extra name.
  // Simple line-based TOML parse: find the section header, then collect keys until next section.
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const extras = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "[project.optional-dependencies]") {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (trimmed.startsWith("[")) break; // next section
      const keyMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=/);
      if (keyMatch) extras.push(keyMatch[1]);
    }
  }
  return extras;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatorRoot = path.join(repoRoot, "submodules", "datam8-generator");
const runtimeRoot = path.join(repoRoot, "artifacts", "python-runtime");

function fail(message) {
  console.error(`[build:python-runtime] ${message}`);
  process.exit(1);
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { shell: false, stdio: "inherit", ...options });
  if (result.error?.code === "ENOENT") {
    fail(`Command not found: ${command}`);
  }
  if ((result.status ?? 1) !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function probePythonInfo(command, preArgs = []) {
  const code = [
    "import json",
    "import sys",
    "print(json.dumps({",
    "  'major': sys.version_info[0],",
    "  'minor': sys.version_info[1],",
    "  'executable': sys.executable,",
    "  'prefix': sys.prefix,",
    "  'base_prefix': sys.base_prefix,",
    "}))",
  ].join("\n");
  const result = spawnSync(command, [...preArgs, "-c", code], {
    shell: false,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (result.error || (result.status ?? 1) !== 0) return null;
  try {
    const parsed = JSON.parse(`${result.stdout || ""}`.trim() || "null");
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.major !== "number" || typeof parsed.minor !== "number") return null;
    if (typeof parsed.executable !== "string" || !parsed.executable.trim()) return null;
    if (typeof parsed.base_prefix !== "string" || !parsed.base_prefix.trim()) return null;
    return {
      major: parsed.major,
      minor: parsed.minor,
      executable: parsed.executable,
      prefix: typeof parsed.prefix === "string" ? parsed.prefix : "",
      basePrefix: parsed.base_prefix,
    };
  } catch {
    return null;
  }
}

function isSupportedRuntimePython(info) {
  // datam8-generator build hooks are currently validated on 3.12/3.13.
  // Rejecting 3.14+ avoids late failures during pip install/metadata generation.
  return info.major === 3 && (info.minor === 12 || info.minor === 13);
}

function resolveBuildPython() {
  const override = `${process.env.DATAM8_RUNTIME_PYTHON || ""}`.trim();
  if (override) {
    const info = probePythonInfo(override, []);
    if (!info || !isSupportedRuntimePython(info)) {
      fail(`DATAM8_RUNTIME_PYTHON must point to Python 3.12 or 3.13: ${override}`);
    }
    return { command: override, preArgs: [], info };
  }

  const candidates =
    process.platform === "win32"
      ? [
          { command: "py", preArgs: ["-3.12"] },
          { command: "py", preArgs: ["-3.13"] },
          { command: "python3.12", preArgs: [] },
          { command: "python3.13", preArgs: [] },
          { command: "py", preArgs: ["-3"] },
          { command: "python", preArgs: [] },
        ]
      : [
          { command: "python3.12", preArgs: [] },
          { command: "python3.13", preArgs: [] },
          { command: "python3", preArgs: [] },
          { command: "python", preArgs: [] },
        ];

  for (const candidate of candidates) {
    const info = probePythonInfo(candidate.command, candidate.preArgs);
    if (!info) continue;
    if (isSupportedRuntimePython(info)) {
      return { ...candidate, info };
    }
  }
  return null;
}

function runtimePythonCandidates() {
  if (process.platform === "win32") {
    return [path.join(runtimeRoot, "python.exe"), path.join(runtimeRoot, "Scripts", "python.exe")];
  }
  return [path.join(runtimeRoot, "bin", "python3"), path.join(runtimeRoot, "bin", "python"), path.join(runtimeRoot, "python3")];
}

if (!fs.existsSync(generatorRoot)) {
  fail(`Missing submodule at ${generatorRoot}. Run: git submodule update --init --recursive`);
}
if (!fs.existsSync(path.join(generatorRoot, "pyproject.toml"))) {
  fail(`Missing pyproject.toml in ${generatorRoot}`);
}

const buildPython = resolveBuildPython();
if (!buildPython) {
  fail("Python 3.12/3.13 not found. Install Python 3.12 (recommended) or set DATAM8_RUNTIME_PYTHON.");
}
const sourcePrefix = path.resolve(buildPython.info.basePrefix);
if (!fs.existsSync(sourcePrefix) || !fs.statSync(sourcePrefix).isDirectory()) {
  fail(`Python base prefix directory not found: ${sourcePrefix}`);
}

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(path.dirname(runtimeRoot), { recursive: true });

console.log(`[build:python-runtime] Copying Python runtime from ${sourcePrefix}`);
fs.cpSync(sourcePrefix, runtimeRoot, { recursive: true, dereference: true });

if (process.platform === "win32") {
  for (const candidate of ["python3.exe", "python3.12.exe"]) {
    const fullPath = path.join(runtimeRoot, candidate);
    try {
      const stat = fs.lstatSync(fullPath);
      // Defensive cleanup for malformed entries observed on some CI images.
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch {
      // ignore missing/invalid paths
    }
  }
}

const runtimePython = runtimePythonCandidates().find((candidate) => fs.existsSync(candidate));
if (!runtimePython) {
  fail(`Python executable not found in copied runtime: ${runtimeRoot}`);
}

runChecked(runtimePython, ["-m", "pip", "install", "--disable-pip-version-check", "--upgrade", "pip", "setuptools", "wheel"]);
const generatorExtras = resolveGeneratorExtras(generatorRoot);
const generatorInstallSpec = generatorExtras.length > 0
  ? `${generatorRoot}[${generatorExtras.join(",")}]`
  : generatorRoot;
console.log(`[build:python-runtime] Installing datam8 with extras: [${generatorExtras.join(", ") || "none"}]`);
runChecked(runtimePython, ["-m", "pip", "install", "--disable-pip-version-check", "--upgrade", generatorInstallSpec]);

const probe = spawnSync(runtimePython, ["-m", "datam8", "--help"], { shell: false, stdio: "pipe", encoding: "utf8" });
if ((probe.status ?? 1) !== 0) {
  const stderr = `${probe.stderr || ""}`.trim();
  fail(`Runtime probe failed for 'python -m datam8 --help'. ${stderr}`);
}

console.log(`[build:python-runtime] OK at ${path.relative(repoRoot, runtimeRoot)}`);
