import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { unusedLoopbackPort } from "./test-port.mjs";
import { withBackend } from "./backend-smoke.mjs";

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

async function smokeBackend() {
  const generatorRoot = resolveGeneratorProjectRoot();
  if (!generatorRoot) {
    throw new Error("Missing datam8-generator project. Set DATAM8_GENERATOR_PROJECT or initialize submodule.");
  }

  const token = "ci-token";
  const host = "127.0.0.1";
  const port = Number(process.env.DATAM8_CI_GATE_PORT || await unusedLoopbackPort());
  const fallbackBaseUrl = `http://${host}:${port}`;
  const uvCmd = process.platform === "win32" ? "uv.exe" : "uv";
  const env = { ...process.env, DATAM8_MODE: "electron", UV_PROJECT_ENVIRONMENT: ".venv-ci" };
  delete env.VIRTUAL_ENV;
  const fixture = copyFixtureToTemp();

  try {
    await withBackend(
      uvCmd,
      [
        "run",
        "--frozen",
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
        env,
        shell: false,
      },
      fallbackBaseUrl, token, async baseUrl => {
        await verifyBackendGate(baseUrl, fixture.solutionPath, token);
      },
    );
  } finally { fs.rmSync(fixture.tmp, { recursive: true, force: true }); }
}

export async function verifyBackendGate(baseUrl, solutionPath, token) {
  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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
  if (!generate.ok) throw new Error(`Generation failed: HTTP ${generate.status} ${JSON.stringify(payload)}`);
  if (typeof payload?.target === "string" && payload.target !== "test") throw new Error(`Unexpected generate target: ${JSON.stringify(payload)}`);
  const generatedHello = path.join(path.dirname(solutionPath), "Output", "generated", "hello.txt");
  if (!fs.existsSync(generatedHello) || fs.readFileSync(generatedHello, "utf8").trim() !== "Hello world") {
    throw new Error("Generation did not produce the expected hello.txt content");
  }
}

async function main() {
  assertNoBannedStrings();
  await smokeBackend();
  console.log("[ci-gates] OK");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
