import fs from "node:fs";
import os from "node:os";
import { buildPythonEnv } from "../apps/desktop/resources/backend-env.cjs";
import { checked, validateMacBinaries } from "./mac-runtime.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unusedLoopbackPort } from "./test-port.mjs";
import { waitForJson, withBackend } from "./backend-smoke.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFixture = path.join(repoRoot, "scripts", "fixtures", "job_solution", "TestSolution.dm8s");

function fail(message) {
  throw new Error(`[smoke-python-runtime] ${message}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) fail(`Missing value for --${key}`);
    parsed[key] = value;
    i += 1;
  }
  return parsed;
}

function walkDirs(root, visit) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    visit(dir);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      stack.push(path.join(dir, entry.name));
    }
  }
}

function findRuntimeRoots(searchRoot) {
  const roots = [];
  if (!fs.existsSync(searchRoot)) return roots;

  const direct = path.basename(searchRoot) === "python-runtime" ? searchRoot : path.join(searchRoot, "python-runtime");
  if (fs.existsSync(direct)) roots.push(direct);

  walkDirs(searchRoot, (dir) => {
    if (path.basename(dir) !== "python-runtime") return;
    if (!roots.includes(dir)) roots.push(dir);
  });

  return roots;
}

function runtimePythonCandidates(runtimeRoot) {
  return process.platform === "win32"
    ? [
        path.join(runtimeRoot, "python.exe"),
        path.join(runtimeRoot, "Scripts", "python.exe"),
        path.join(runtimeRoot, "pythonw.exe"),
      ]
    : [
        path.join(runtimeRoot, "bin", "python3"),
        path.join(runtimeRoot, "bin", "python"),
        path.join(runtimeRoot, "python3"),
      ];
}

function resolveRuntimeRoot(args) {
  const explicitRuntime = args["runtime-root"];
  if (explicitRuntime) return path.resolve(explicitRuntime);

  const roots = [
    args.resources,
    args["release-dir"],
    path.join(repoRoot, "apps", "desktop", "release"),
  ].filter(Boolean).map((entry) => path.resolve(entry));

  for (const root of roots) {
    const matches = findRuntimeRoots(root);
    const match = matches.find((candidate) => runtimePythonCandidates(candidate).some((python) => fs.existsSync(python)));
    if (match) return match;
  }

  fail(`Could not find packaged python-runtime under: ${roots.join(", ")}`);
}

function resolvePython(runtimeRoot) {
  const python = runtimePythonCandidates(runtimeRoot).find((candidate) => fs.existsSync(candidate));
  if (!python) fail(`Python executable not found in runtime: ${runtimeRoot}`);
  return python;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceFixture = path.resolve(args.fixture || process.env.DATAM8_RUNTIME_SMOKE_SOLUTION || defaultFixture);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "DataM8 runtime smoke "));
  try {
    fs.cpSync(path.dirname(sourceFixture), path.join(temp, "Solution copy"), { recursive: true });
    const fixture = path.join(temp, "Solution copy", path.basename(sourceFixture));
    if (!fs.existsSync(fixture)) fail(`Fixture solution not found: ${fixture}`);

    const runtimeRoot = resolveRuntimeRoot(args);
    const python = args.python ? path.resolve(args.python) : resolvePython(runtimeRoot);
    const env = buildPythonEnv(python, runtimeRoot);
    if (process.platform === "darwin") validateMacBinaries(runtimeRoot);
    checked(python, ["-c", "import sys, os, ssl, sqlite3, lzma, decimal, ctypes, encodings; root=os.path.realpath(sys.argv[1]); assert os.path.realpath(sys.prefix)==root; assert os.path.realpath(encodings.__file__).startswith(root+os.sep); print(sys.version)" , runtimeRoot], { env, cwd: temp });

    console.log(`[smoke-python-runtime] Runtime: ${runtimeRoot}`);
    console.log(`[smoke-python-runtime] Python: ${python}`);

    checked(python, ["-m", "datam8", "--help"], { env });
    checked(
      python,
      [
        "-c",
        "import keyring; from keyring.backends.fail import Keyring as Failed; assert not isinstance(keyring.get_keyring(), Failed), 'No available secret backend'",
      ],
      { env },
    );

    const port = Number(args.port || process.env.DATAM8_RUNTIME_SMOKE_PORT || await unusedLoopbackPort());
    const token = `smoke-${Date.now().toString(36)}`;
    const fallbackBaseUrl = `http://127.0.0.1:${port}`;
    await withBackend(
      python,
      [
        "-m",
        "datam8",
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--token",
        token,
        "--solution",
        fixture,
        "--log-level",
        "warning",
      ],
      { env, cwd: temp }, fallbackBaseUrl, token, async baseUrl => {
        await waitForJson(baseUrl, "/version", token);
        await waitForJson(baseUrl, "/config", token);
        console.log(`[smoke-python-runtime] OK: ${baseUrl}`);
      },
    );
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
