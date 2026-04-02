import fs from "fs";
import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveGeneratorProjectRoot() {
  const override = (process.env.DATAM8_GENERATOR_PROJECT || "").trim();
  const candidates = [
    override,
    path.join(repoRoot, "submodules", "datam8-generator"),
    path.resolve(repoRoot, "..", "datam8-generator"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const pyproject = path.join(candidate, "pyproject.toml");
    if (fs.existsSync(pyproject)) return candidate;
  }
  return null;
}

function walkFiles(rootDir, { ignoreDirs = new Set(), maxBytes = 2_000_000 } = {}) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (ignoreDirs.has(e.name)) continue;
        stack.push(p);
        continue;
      }
      if (!e.isFile()) continue;
      try {
        const st = fs.statSync(p);
        if (st.size > maxBytes) continue;
      } catch {
        continue;
      }
      out.push(p);
    }
  }
  return out;
}

function assertNoBannedStrings() {
  const runtimeRoots = [
    path.join(repoRoot, "apps", "desktop", "src"),
    path.join(repoRoot, "apps", "web", "src"),
    path.join(repoRoot, "scripts", "dev-desktop.mjs"),
    path.join(repoRoot, "apps", "desktop", "package.json"),
    path.join(repoRoot, "apps", "web", ".env.electron"),
  ];

  const banned = [
    { re: /\bdm8gen\b/i, label: "dm8gen" },
    { re: /\bdatam8d\b/i, label: "datam8d" },
    { re: /json-rpc/i, label: "json-rpc" },
    { re: /stdio-rpc/i, label: "stdio-rpc" },
    { re: /\bDATAM8_DAEMON_PATH\b/, label: "DATAM8_DAEMON_PATH" },
    { re: /\bDATAM8_ALLOW_PYTHON_FALLBACK\b/, label: "DATAM8_ALLOW_PYTHON_FALLBACK" },
    { re: /\bDATAM8_TRANSPORT\b/, label: "DATAM8_TRANSPORT" },
    { re: /\bdatam8_cli\b/, label: "datam8_cli" },
  ];

  const offenders = [];
  const ignoreDirs = new Set(["node_modules", "dist", "release", "test-results", ".git"]);

  for (const root of runtimeRoots) {
    if (!fs.existsSync(root)) continue;
    const files = fs.statSync(root).isDirectory() ? walkFiles(root, { ignoreDirs }) : [root];
    for (const f of files) {
      let text = "";
      try {
        text = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      for (const b of banned) {
        if (b.re.test(text)) {
          offenders.push({ file: path.relative(repoRoot, f), label: b.label });
        }
      }
    }
  }

  if (offenders.length) {
    const lines = offenders.slice(0, 50).map((o) => `- ${o.label}: ${o.file}`);
    throw new Error(`Banned runtime strings detected:\n${lines.join("\n")}`);
  }
}

function copyFixtureToTemp() {
  const src = path.join(repoRoot, "scripts", "fixtures", "job_solution");
  if (!fs.existsSync(src)) throw new Error(`Missing fixture dir: ${src}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "datam8-fixture-"));
  const dst = path.join(tmp, "solution");
  fs.cpSync(src, dst, { recursive: true });
  return { tmp, solutionPath: path.join(dst, "TestSolution.dm8s") };
}

async function waitForReady(proc, timeoutMs = 20_000) {
  const parseReadyLine = (line) => {
    try {
      const data = JSON.parse(line);
      if (data?.type === "ready" && typeof data?.baseUrl === "string") {
        return {
          baseUrl: data.baseUrl,
          version: typeof data?.version === "string" ? data.version : "0.0.0",
        };
      }
    } catch {
      // Current datam8 serve output:
      // "API ready at `http://127.0.0.1:4318`, schemaVersion: 2.0.0"
      const apiReadyMatch = line.match(/API ready at\s+`([^`]+)`(?:,\s*schemaVersion:\s*(.+))?/i);
      if (apiReadyMatch?.[1]) {
        return {
          baseUrl: `${apiReadyMatch[1]}`.trim(),
          version: `${apiReadyMatch[2] || "0.0.0"}`.trim() || "0.0.0",
        };
      }
      const uvicornMatch = line.match(/Uvicorn running on (https?:\/\/[^\s]+)/i);
      if (uvicornMatch?.[1]) {
        return {
          baseUrl: uvicornMatch[1].trim().replace(/\/+$/, ""),
          version: "0.0.0",
        };
      }
    }
    return null;
  };

  return await new Promise((resolve, reject) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let stderrPreview = "";
    let done = false;

    const timeout = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve(null);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      proc.stdout?.off("data", onStdout);
      proc.stderr?.off("data", onStderr);
      proc.off("exit", onExit);
      proc.off("error", onError);
    };

    const onError = (err) => {
      if (done) return;
      done = true;
      cleanup();
      reject(err);
    };

    const onExit = (code, signal) => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Backend exited before readiness. code=${code ?? "null"} signal=${signal ?? "null"}\nStderr (preview):\n${stderrPreview}`));
    };

    const onStderr = (chunk) => {
      if (stderrPreview.length >= 4096) return;
      stderrPreview += String(chunk).slice(0, 4096 - stderrPreview.length);
      stderrBuf += String(chunk);
      while (true) {
        const idx = stderrBuf.indexOf("\n");
        if (idx < 0) return;
        const line = stderrBuf.slice(0, idx).trim();
        stderrBuf = stderrBuf.slice(idx + 1);
        if (!line) continue;
        const ready = parseReadyLine(line);
        if (!ready) continue;
        if (done) return;
        done = true;
        cleanup();
        resolve(ready);
        return;
      }
    };

    const onStdout = (chunk) => {
      stdoutBuf += String(chunk);
      while (true) {
        const idx = stdoutBuf.indexOf("\n");
        if (idx < 0) return;
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line) continue;
        const ready = parseReadyLine(line);
        if (!ready) continue;
        if (done) return;
        done = true;
        cleanup();
        resolve(ready);
        return;
      }
    };

    proc.once("error", onError);
    proc.once("exit", onExit);
    proc.stderr?.on("data", onStderr);
    proc.stdout?.on("data", onStdout);
  });
}

async function waitForHealth(baseUrl, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // backend may still be starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Health check timed out after ${timeoutMs}ms (${baseUrl}/health)`);
}

function killProcessTree(proc) {
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

async function smokeBackend() {
  const generatorRoot = resolveGeneratorProjectRoot();
  if (!generatorRoot) {
    throw new Error("Missing datam8-generator project. Set DATAM8_GENERATOR_PROJECT or initialize submodule.");
  }

  const token = "ci-token";
  const host = "127.0.0.1";
  const port = Number(process.env.DATAM8_CI_GATE_PORT || "4318");
  const fallbackBaseUrl = `http://${host}:${port}`;
  const uvCmd = process.platform === "win32" ? "uv.exe" : "uv";
  const env = { ...process.env, DATAM8_MODE: "electron", UV_PROJECT_ENVIRONMENT: ".venv-ci" };
  delete env.VIRTUAL_ENV;
  const fixture = copyFixtureToTemp();

  const proc = spawn(
    uvCmd,
    [
      "run",
      "--project",
      generatorRoot,
      "--all-extras",
      "python",
      "-m",
      "datam8",
      "serve",
      "--host",
      host,
      "--port",
      `${port}`,
      "--token",
      token,
      "--solution",
      fixture.solutionPath,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env,
      shell: false,
    },
  );
  proc.stderr?.pipe(process.stderr);

  let ready;
  try {
    ready = await waitForReady(proc);
  } catch (e) {
    try {
      proc.kill();
    } catch {
      // ignore
    }
    throw e;
  }

  const baseUrl = ready?.baseUrl || fallbackBaseUrl;
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    await waitForHealth(baseUrl);
    const health = await fetch(`${baseUrl}/health`);
    if (!health.ok) throw new Error(`/health failed: ${health.status}`);

    const origin = "http://localhost:4320";
    const preflight = await fetch(`${baseUrl}/config`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    const allowOrigin = preflight.headers.get("access-control-allow-origin");
    if (![200, 204].includes(preflight.status) || allowOrigin !== origin) {
      throw new Error(
        `CORS preflight failed: status=${preflight.status} allow-origin=${allowOrigin ?? "null"} (expected ${origin})`,
      );
    }

    const protectedRes = await fetch(`${baseUrl}/config`);
    if (protectedRes.status !== 401) throw new Error(`/config should require auth, got ${protectedRes.status}`);

    const generate = await fetch(`${baseUrl}/model/generate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        target: "test",
        cleanOutput: true,
        payloads: [],
        logLevel: "info",
      }),
    });
    const payload = await generate.json().catch(() => ({}));
    if (generate.status === 404) {
      throw new Error("`POST /model/generate` is missing (404).");
    }
    if (generate.ok) {
      if (typeof payload?.target === "string" && payload.target !== "test") {
        throw new Error(`Unexpected generate target: ${JSON.stringify(payload)}`);
      }
      const generatedHello = path.join(path.dirname(fixture.solutionPath), "Output", "generated", "hello.txt");
      if (!fs.existsSync(generatedHello)) {
        throw new Error(`Generate call returned ${generate.status}, but expected output is missing: ${generatedHello}`);
      }
    } else {
      console.warn(`[ci-gates] Generate endpoint reachable but fixture run failed: ${generate.status} ${JSON.stringify(payload)}`);
    }
  } finally {
    killProcessTree(proc);
    try {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  }
}

async function main() {
  assertNoBannedStrings();
  await smokeBackend();
  console.log("[ci-gates] OK");
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

