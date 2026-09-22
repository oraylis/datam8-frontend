import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFixture = path.join(repoRoot, "scripts", "fixtures", "job_solution", "TestSolution.dm8s");
const outputLimit = 16_384;

function fail(message) {
  console.error(`[smoke-python-runtime] ${message}`);
  process.exit(1);
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
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(python, 0o755);
    } catch {
      // Let the spawn failure report the real issue.
    }
  }
  return python;
}

function buildPythonEnv(runtimeRoot) {
  const env = { ...process.env, DATAM8_MODE: "electron" };
  if (process.env.DATAM8_SMOKE_KEEP_PYTHONPATH !== "1") {
    delete env.PYTHONPATH;
  }
  if (process.platform !== "win32") {
    env.PYTHONHOME = runtimeRoot;
    env.PYTHONNOUSERSITE = "1";
  }
  return env;
}

function runChecked(command, args, options) {
  const result = spawnSync(command, args, {
    shell: false,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
  if (result.error) {
    fail(`Command failed to start: ${command}\n${result.error.message}`);
  }
  if ((result.status ?? 1) !== 0) {
    fail(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `Exit: status=${result.status ?? "null"} signal=${result.signal ?? "null"}`,
        "stdout:",
        `${result.stdout || ""}`.trim(),
        "stderr:",
        `${result.stderr || ""}`.trim(),
      ].join("\n"),
    );
  }
}

async function findFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function parseReadyLine(line) {
  try {
    const data = JSON.parse(line);
    if (data?.type === "ready" && typeof data.baseUrl === "string") {
      return data.baseUrl.replace(/\/+$/, "");
    }
  } catch {
    const apiReady = line.match(/API ready at\s+`([^`]+)`/i);
    if (apiReady?.[1]) return apiReady[1].trim().replace(/\/+$/, "");
    const uvicorn = line.match(/Uvicorn running on (https?:\/\/[^\s]+)/i);
    if (uvicorn?.[1]) return uvicorn[1].trim().replace(/\/+$/, "");
  }
  return null;
}

async function waitForReady(proc, fallbackBaseUrl, preview, timeoutMs = 60_000) {
  return await new Promise((resolve, reject) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let done = false;

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      cleanup();
      fn(value);
    };

    const timeout = setTimeout(() => finish(reject, new Error(`Backend readiness timed out. Output preview:\n${preview.value}`)), timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout?.off("data", onStdout);
      proc.stderr?.off("data", onStderr);
      proc.off("exit", onExit);
      proc.off("error", onError);
    };

    const append = (label, chunk) => {
      const text = String(chunk);
      if (preview.value.length < outputLimit) {
        preview.value += `[${label}] ${text.slice(0, outputLimit - preview.value.length)}`;
      }
      return text;
    };

    const consume = (buffer, chunk, label) => {
      buffer += append(label, chunk);
      while (true) {
        const idx = buffer.indexOf("\n");
        if (idx < 0) return buffer;
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        const readyBaseUrl = parseReadyLine(line);
        if (readyBaseUrl) {
          finish(resolve, readyBaseUrl);
          return buffer;
        }
      }
    };

    const onStdout = (chunk) => {
      stdoutBuf = consume(stdoutBuf, chunk, "stdout");
    };
    const onStderr = (chunk) => {
      stderrBuf = consume(stderrBuf, chunk, "stderr");
    };
    const onError = (err) => finish(reject, err);
    const onExit = (code, signal) => {
      finish(reject, new Error(`Backend exited before readiness. code=${code ?? "null"} signal=${signal ?? "null"}\nOutput preview:\n${preview.value}`));
    };

    proc.stdout?.setEncoding("utf8");
    proc.stderr?.setEncoding("utf8");
    proc.stdout?.on("data", onStdout);
    proc.stderr?.on("data", onStderr);
    proc.once("error", onError);
    proc.once("exit", onExit);

    setTimeout(() => {
      if (!done) finish(resolve, fallbackBaseUrl);
    }, 5_000).unref();
  });
}

async function waitForJson(baseUrl, pathName, token, timeoutMs = 30_000) {
  const start = Date.now();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}${pathName}`, { headers });
      if (res.ok) return await res.json().catch(() => ({}));
      lastError = `${res.status} ${res.statusText}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${pathName} failed after ${timeoutMs}ms: ${lastError}`);
}

function killProcess(proc) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = path.resolve(args.fixture || process.env.DATAM8_RUNTIME_SMOKE_SOLUTION || defaultFixture);
  if (!fs.existsSync(fixture)) fail(`Fixture solution not found: ${fixture}`);

  const runtimeRoot = resolveRuntimeRoot(args);
  const python = args.python ? path.resolve(args.python) : resolvePython(runtimeRoot);
  const env = buildPythonEnv(runtimeRoot);

  console.log(`[smoke-python-runtime] Runtime: ${runtimeRoot}`);
  console.log(`[smoke-python-runtime] Python: ${python}`);

  runChecked(python, ["-m", "datam8", "--help"], { env });
  runChecked(
    python,
    [
      "-c",
      "import keyring; from keyring.backends.fail import Keyring as Failed; assert not isinstance(keyring.get_keyring(), Failed), 'No available secret backend'",
    ],
    { env },
  );

  const port = Number(args.port || process.env.DATAM8_RUNTIME_SMOKE_PORT || await findFreePort());
  const token = `smoke-${Date.now().toString(36)}`;
  const fallbackBaseUrl = `http://127.0.0.1:${port}`;
  const preview = { value: "" };
  const backend = spawn(
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
    { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );

  try {
    const baseUrl = await waitForReady(backend, fallbackBaseUrl, preview);
    await waitForJson(baseUrl, "/health", token);
    await waitForJson(baseUrl, "/version", token);
    console.log(`[smoke-python-runtime] OK: ${baseUrl}`);
  } catch (err) {
    fail(`${err instanceof Error ? err.message : String(err)}\nOutput preview:\n${preview.value}`);
  } finally {
    killProcess(backend);
  }
}

main().catch((err) => {
  fail(err?.stack || String(err));
});
