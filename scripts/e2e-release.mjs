import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsWebRoot = path.join(repoRoot, "apps", "web");
const releasePort = Number(process.env.DATAM8_RELEASE_PORT || "4318");
const releaseApiBase = `http://127.0.0.1:${releasePort}`;

function findDefaultPython() {
  if (process.platform === "win32") {
    return path.join(repoRoot, "submodules", "datam8-generator", ".venv", "Scripts", "python.exe");
  }
  return path.join(repoRoot, "submodules", "datam8-generator", ".venv", "bin", "python");
}

function killTree(proc) {
  if (!proc?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore
  }
}

function findSingleDm8s(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".dm8s"));
  if (files.length !== 1) {
    throw new Error(`Expected exactly one .dm8s in ${dir}, got ${files.length}.`);
  }
  return path.join(dir, files[0]);
}

function copySampleToTemp(sourceDm8s) {
  const sourceDir = path.dirname(sourceDm8s);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "datam8-release-"));
  const copiedDir = path.join(tempRoot, path.basename(sourceDir));
  fs.cpSync(sourceDir, copiedDir, { recursive: true });
  const copiedDm8s = findSingleDm8s(copiedDir);
  return { tempRoot, copiedDm8s };
}

async function waitForHealth(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${releaseApiBase}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Backend health check timed out after ${timeoutMs}ms (${releaseApiBase}/health).`);
}

function ensurePathExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

async function main() {
  const samplePath = (process.env.DATAM8_SAMPLE_SOLUTION_PATH || "").trim();
  if (!samplePath) {
    throw new Error("Set DATAM8_SAMPLE_SOLUTION_PATH to a .dm8s file.");
  }
  ensurePathExists(samplePath, "Sample solution");

  const pythonPath = (process.env.DATAM8_PYTHON_PATH || findDefaultPython()).trim();
  ensurePathExists(pythonPath, "Python runtime");

  const { tempRoot, copiedDm8s } = copySampleToTemp(samplePath);
  console.log(`[release-e2e] Using temp solution copy: ${copiedDm8s}`);

  const serveArgs = [
    "-m",
    "datam8",
    "serve",
    "--host",
    "127.0.0.1",
    "--port",
    String(releasePort),
    "--solution",
    copiedDm8s,
    "--log-level",
    "info",
  ];

  const backend = spawn(pythonPath, serveArgs, {
    cwd: repoRoot,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  backend.stdout?.on("data", (chunk) => process.stdout.write(`[backend] ${String(chunk)}`));
  backend.stderr?.on("data", (chunk) => process.stderr.write(`[backend] ${String(chunk)}`));

  let exitCode = 0;
  try {
    await waitForHealth();
    console.log(`[release-e2e] Backend ready at ${releaseApiBase}`);

    const npmScript = (process.env.DATAM8_RELEASE_NPM_SCRIPT || "e2e:release").trim();
    const command = process.platform === "win32" ? `npm run ${npmScript}` : `npm run ${npmScript}`;
    const child = spawn(command, {
      cwd: appsWebRoot,
      env: {
        ...process.env,
        DATAM8_RELEASE_API_BASE: releaseApiBase,
        DATAM8_RELEASE_SOLUTION_PATH: copiedDm8s,
      },
      stdio: "inherit",
      windowsHide: true,
      shell: true,
    });

    exitCode = await new Promise((resolve) => {
      child.on("exit", (code) => resolve(code ?? 1));
      child.on("error", () => resolve(1));
    });
  } finally {
    killTree(backend);
    if (process.env.DATAM8_KEEP_RELEASE_TMP !== "1") {
      try {
        fs.rmSync(tempRoot, { recursive: true, force: true });
      } catch {
        // ignore
      }
    } else {
      console.log(`[release-e2e] Keeping temp dir: ${tempRoot}`);
    }
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
